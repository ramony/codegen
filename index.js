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
const getTables = (connection) => {
  return new Promise((resolve, reject) => {
    connection.query('SHOW TABLES', (err, results) => {
      if (err) {
        console.error('获取表名失败:', err);
        reject(err);
      } else {
        const tables = results.map(row => row[Object.keys(row)[0]]);
        resolve(tables);
      }
    });
  });
};

// 获取指定表的字段结构
const getFields = (connection, table) => {
  return new Promise((resolve, reject) => {
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
      //console.log(`表名: ${tableName}`);
      const fields = await getFields(connection, tableName);
      fields?.forEach(field => {
        table.fields.push(field)
      });
      tables.push(table)
    }
    return tables
  } catch (err) {
    console.error('发生错误:');
  } finally {
    connection.end();
  }
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

  const vmFolder = "templates\\" + config.template;
  const vmFiles = listVM(vmFolder);

  const globalCotent = readVM(vmFolder + "\\" + "global.vm")
  const templates = []
  for (const fileName of vmFiles) {
    const vmContent = globalCotent + readVM(vmFolder + "\\" + fileName)
    templates.push(vmContent)
  }

  const typeMapping = readJsonFile("typeMapping.json")

  const contexts = dbToJava(tables, typeMapping)

  for (const context of contexts) {
    console.log(JSON.stringify(context))
    for (const template of templates) {
      const output = render(template, context);
      console.log(output)
    }
  }

};

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
    const tableFields = it.fields.map(col => {
      const Field = convertToCamelCase(col.field);
      const field = lowerCaseFirstLetter(Field);

      const fieldType = col.type.replace(" unsigned", "");
      let type = typeMapping.filter(t => {
        if (t.matchType == 'REGEX') {
          return new RegExp(t.columnType).test(fieldType);
        }
        return false;
      }).map(t => t.javaType)?.[0];
      if (!type) {
        type = "java.lang.Object";
      }

      return { ...col, Field, field, type }
    })
    return { TableName, tableName, tableFields }
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
  const vmPath = path.join(__dirname, fileName);
  const content = fs.readFileSync(vmPath, 'utf8');
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