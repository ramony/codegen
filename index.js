const mysql = require('mysql2');

const { parse, render } = require('velocityjs');
const fs = require('fs');
const path = require('path');

// 从 JSON 文件读取 MySQL 配置
const readJsonFile = (jsonFile) => {
  try {
    const data = fs.readFileSync(jsonFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取配置文件失败:', err);
    throw err;
  }
};

// 连接到 MySQL 数据库
const connectToDatabase = (config) => {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });
};

// 获取数据库中所有表名
// const getTables = (connection) => {
//   return new Promise((resolve, reject) => {
//     connection.query('SHOW TABLES', (err, results) => {
//       if (err) {
//         console.error('获取表名失败:', err);
//         reject(err);
//       } else {
//         const tables = results.map(row => row[Object.keys(row)[0]]);
//         resolve(tables);
//       }
//     });
//   });
// };

const getTableComment2 = async (connection, tableName) => {
  try {
    // 查询表注释
    const [rows] = await connection.execute(`
          SELECT TABLE_COMMENT 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [config.database, tableName]);
    if (rows.length > 0) {
      return rows[0].TABLE_COMMENT;
    } else {
      return null;
    }
  } catch (error) {
    console.error('获取表注释时出错:', error);
    return null;
  }
}


const getTableComment = async (connection, table) => {
  return new Promise((resolve) => {
    connection.query(`SELECT * 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = '${table}'`, (err, results) => {
      if (err) {
        console.error(`获取表 ${table} 的comment失败:${err}`);
        resolve(null);
      } else {
        console.log("bb" + JSON.stringify(results))
        const comments = results.map(row => row.TABLE_COMMENT);
        resolve(comments[0]);
      }
    });
  });
}

const getTableFieldsComment = async (connection, table) => {
  return new Promise((resolve) => {
    connection.query(`SELECT COLUMN_NAME, COLUMN_COMMENT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE  TABLE_NAME = '${table}'`, (err, results) => {
      if (err) {
        console.error(`获取表 ${table} 的comment失败:${err}`);
        resolve(null);
      } else {
        console.log("bb" + JSON.stringify(results))
        const comments = results.map(row => [row.COLUMN_NAME, row.COLUMN_COMMENT]);
        resolve(Object.fromEntries(comments));
      }
    });
  });
}


// 获取指定表的字段结构
const getFields = (connection, table) => {
  return new Promise((resolve) => {
    connection.query(`DESCRIBE ${table}`, (err, results) => {
      if (err) {
        console.error(`获取表 ${table} 的字段结构失败:`);
        resolve(null);
      } else {
        const fields = results.map(row => ({
          field: row.Field,
          type: row.Type,
          isnull: row.Null,
          key: row.Key,
          def: row.Default,
          extra: row.Extra
        }));
        resolve(fields);
      }
    });
  });
};

const loadTables = async (connection, tableNames) => {
  const tables = [];
  try {
    for (const tableName of tableNames) {
      const table = { name: tableName, fields: [] }
      table.comment = await getTableComment(connection, tableName);
      console.log(`aa ${table.comment}`);
      const fieldsCommentMap = await getTableFieldsComment(connection, tableName);

      table.fields = await getFields(connection, tableName);
      table.fields?.forEach(field => {
        field.comment = fieldsCommentMap[field.field];
      });
      tables.push(table);
    }
    return tables
  } catch (err) {
    console.error('发生错误:', err);
  } finally {
    connection.end();
  }
}

function filterEdgeEmptyStrings(array) {
  let start = 0;
  let end = array.length - 1;

  // 找到第一个非空字符串的索引
  while (start < array.length && array[start] === '') {
    start++;
  }

  // 找到最后一个非空字符串的索引
  while (end >= 0 && array[end] === '') {
    end--;
  }

  // 提取从第一个非空字符串到最后一个非空字符串之间的元素
  const middleArr = array.slice(start, end + 1);
  const result = [];
  let hasEmpty = false;

  for (let i = 0; i < middleArr.length; i++) {
    if (middleArr[i] === '') {
      if (!hasEmpty) {
        result.push('');
        hasEmpty = true;
      }
    } else {
      result.push(middleArr[i]);
      hasEmpty = false;
    }
  }

  return result;
}


const main = async () => {
  const args = process.argv.slice(2);
  if (args.length == 0) {
    console.log(`需要task配置文件`);
    return;
  }
  const config = readJsonFile(args[0]);
  const connection = connectToDatabase(config.database);
  const tables = await loadTables(connection, config.tableNames);

  const vmFolder = path.join(__dirname, "templates", config.template);
  const vmFiles = listVM(vmFolder);

  const globalCotent = readVM(path.join(vmFolder, "global.vm"))
  const templates = []
  for (const fileName of vmFiles) {
    const vmContent = globalCotent + "\n" + readVM(path.join(vmFolder, fileName))
    templates.push(vmContent)
  }

  const typeMapping = readJsonFile(path.join(__dirname, "typeMapping.json"))

  const contexts = dbToJava(tables, typeMapping)

  for (const context of contexts) {
    console.log(JSON.stringify(context))
    for (const template of templates) {
      context.save = (fileName) => {
        context.dist = fileName;
      }
      context.package = (pkg) => {
        return "package " + config.prefixPackage + "." + pkg + ";";
      }
      const output = render(template, context);
      if (!context.dist) {
        console.log("模板输出文件没指定");
        continue;
      }
      writeFile(path.join(config.dist, context.dist), filterEdgeEmptyStrings(output.split("\n").map(it => it.trimEnd())).join("\n"));
    }
  }

};

function writeFile(filePathName, data) {
  console.log("write data to", filePathName);
  const filePath = path.dirname(filePathName);
  // 获取文件名
  //const fileName = path.basename(filePathName);
  fs.mkdir(filePath, { recursive: true }, (err) => {
    if (err) {
      console.error('创建目录时出错:', err);
      return;
    }

    // 目录创建成功后，写入文件
    fs.writeFile(filePathName, data, (err) => {
      if (err) {
        console.error('写入文件时出错:', err);
        return;
      }
      console.log('文件写入成功:', filePath);
    });
  });

}

/**
 * field: row.Field,
          type: row.Type,
          isnull: row.Null,
          key: row.Key,
          def: row.Default,
          extra: row.Extra
 * @param {*} tables 
 * @returns 
 */
function dbToJava(tables, typeMapping) {
  return tables.map(it => {
    const TableName = convertToCamelCase(it.name.replace(/^t_/, ""));
    const tableName = lowerCaseFirstLetter(TableName);
    const tablepath = tableName.toLowerCase();
    const tableComment = it.comment;
    const tableFields = it.fields.map(col => {
      const Field = convertToCamelCase(col.field);
      const field = lowerCaseFirstLetter(Field);
      const fieldType = col.type.replace(" unsigned", "");
      const fieldComment = col.comment;
      let fullType = typeMapping.filter(t => {
        if (t.matchType == 'REGEX') {
          return new RegExp(t.columnType).test(fieldType);
        } else if (t.matchType == 'ORDINARY') {
          return t.columnType == fieldType;
        }
        return false;
      }).map(t => t.javaType)?.[0];
      if (!fullType) {
        fullType = "java.lang.Object";
      }
      const type = fullType.split(".").pop()
      return { ...col, Field, field, fullType, type, fieldComment }
    })

    const filter = (source, excludedArray) => {
      return source.filter(it => !excludedArray.includes(it.field))
    }
    const importTypes = (fields) => {
      return fields.filter(it => !it.fullType.includes("java.lang")).map(it => `import ${it.fullType};`).join("\n");
    }
    const result = { TableName, tableName, tableComment, tablepath, tableFields, filter, importTypes };
    return result;
  })
}


//abc_def 转换成 AbcDef
function convertToCamelCase(str) {
  return str.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// AbcDef 转换成 abcDef
function lowerCaseFirstLetter(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// 读取模板文件
function readVM(fileName) {
  const content = fs.readFileSync(fileName, 'utf8');
  return content;
}

function listVM(dir) {
  try {
    // 读取指定目录下的所有文件和文件夹
    const files = fs.readdirSync(dir);
    return files.filter((file) => {
      // 检查文件扩展名是否为 .vm
      if (path.extname(file) === '.vm' && file != "global.vm") {
        // 打印 .vm 文件的完整路径
        return true;
      }
      return false;
    });
  } catch (err) {
    console.error('读取目录时出现错误:', err);
  }
}


main();