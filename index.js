const path = require('path');
const mysql = require('mysql2');
const { render } = require('velocityjs');

const { convertToCamelCase, lowerCaseFirstLetter, sortCode } = require("./lib/strings");
const { readFile, readJsonFile, writeFile, listFile } = require("./lib/files");

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

const getTableComment = async (connection, table) => {
  return new Promise((resolve) => {
    connection.query(`SELECT * 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = '${table}'`, (err, results) => {
      if (err) {
        console.error(`获取表 ${table} 的comment失败:${err}`);
        resolve(null);
      } else {
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

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length == 0) {
    console.error(`需要task配置文件`);
    return;
  }
  const config = readJsonFile(args[0]);
  const connection = connectToDatabase(config.database);
  const tables = await loadTables(connection, config.tableNames);

  const vmFolder = path.join(__dirname, "templates", config.template);
  const vmFiles = listFile(vmFolder).filter((file) => path.extname(file) === '.vm' && file != "global.vm");

  const globalCotent = readFile(path.join(vmFolder, "global.vm"))
  const templates = []
  for (const vmFile of vmFiles) {
    const vmContent = globalCotent + "\n\n" + readFile(path.join(vmFolder, vmFile))
    templates.push({ vmFile, vmContent })
  }

  const typeMapping = readJsonFile(path.join(__dirname, "./config/typeMapping.json"))

  const contexts = dbToJava(tables, typeMapping)

  for (const context of contexts) {
    console.log(`\n开始处理表:${context.name}`)
    for (const template of templates) {
      context.save = (fileName) => {
        context.dist = fileName;
      }
      context.package = (pkg) => {
        return "package " + config.prefixPackage + "." + pkg + ";";
      }
      let output = render(template.vmContent, context);
      if (!context.dist) {
        console.log(`模板${template.vmFile}输出文件没指定`);
        continue;
      }
      if (context.dist.includes("java")) {
        output = sortCode(output)
      }

      console.log(`模板${template.vmFile}开始处理`);
      writeFile(path.join(config.dist, context.dist), output);
    }
  }

};

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
      const fieldsType = fields.map(it => it.fullType).filter(it => !it.includes("java.lang"));
      return [...new Set(fieldsType)].map(it => `import ${it};`).join("\n");
    }
    const result = { name: it.name, TableName, tableName, tableComment, tablepath, tableFields, filter, importTypes };
    return result;
  })
}

main();