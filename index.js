import path from 'path';
import Mysql from './lib/mysql.js';
import velocityjs from 'velocityjs';

import { convertToCamelCase, lowerCaseFirstLetter, formatCode } from "./lib/strings.js";
import { readFile, readJsonFile, writeFile, listFile } from "./lib/files.js";

const loadTables = async (db, tableNames) => {
  const tablesInfo = [];
  for (const tableName of tableNames) {
    tablesInfo.push(await db.querySchema(tableName));
  }
  return tablesInfo
}

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length == 0) {
    console.error(`需要task配置文件`);
    return;
  }

  const config = readJsonFile(args[0]);
  const db = new Mysql(config.database);
  await db.connect();
  const tablesInfo = await loadTables(db, config.tableNames);
  await db.close();

  const vmFolder = path.join("templates", config.template);
  const vmFiles = listFile(vmFolder).filter((file) => path.extname(file) === '.vm' && file != "global.vm");

  const globalCotent = readFile(path.join(vmFolder, "global.vm"))
  const templates = []
  for (const vmFile of vmFiles) {
    let vmContent = readFile(path.join(vmFolder, vmFile));
    vmContent = globalCotent + "\n\n" + vmContent;
    templates.push({ vmFile, vmContent })
  }

  const typeMapping = readJsonFile(path.join("./config/typeMapping.json"))

  for (const tableInfo of tablesInfo) {
    const context = dbToJava(tableInfo, typeMapping, config.preSet);
    console.log(`\n开始处理表:${context.name}`)
    for (const template of templates) {
      context.save = (fileName) => {
        context.dist = fileName;
      }
      context.package = (pkg) => {
        return "package " + config.prefixPackage + "." + pkg + ";";
      }
      let output = velocityjs.render(template.vmContent, context);
      if (!context.dist) {
        console.log(`模板${template.vmFile}输出文件没指定`);
        continue;
      }
      if (context.dist.includes("java")) {
        output = formatCode(output)
      }

      console.log(`模板${template.vmFile}开始处理`);
      writeFile(path.join(config.dist, config.prefixPackage.replace(/\./g, '/'), context.dist), output);
    }
  }

};

const defaultContext = {
  filter(source, excludedArray) {
    return source.filter(it => !excludedArray.includes(it.field))
  },
  importTypes(fields) {
    const fieldsType = fields.map(it => it.fullType).filter(it => !it.includes("java.lang"));
    return [...new Set(fieldsType)].map(it => `import ${it};`).join("\n");
  }
}

function dbToJava(tableInfo, typeMapping, preSet) {
  const { name } = tableInfo;
  const nameShort = name.replace(/^t_/, "");
  const Table = convertToCamelCase(nameShort);
  const table = lowerCaseFirstLetter(Table);
  const tablepath = convertToCamelCase(nameShort.split("_").slice(0, 2).join("_")).toLowerCase();
  const tableComment = tableInfo.comment;
  const tableFields = tableInfo.fields.map(col => {
    const Field = convertToCamelCase(col.field);
    const setField = 'set' + Field;
    const getField = 'get' + Field;

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
    return { ...col, Field, field, fullType, type, fieldComment, setField, getField }
  })

  const result = { ...defaultContext, name, Table, table, tableComment, tablepath, tableFields };
  for (const pre of preSet) {
    result["table" + pre] = table + pre;
    result["Table" + pre] = Table + pre;
  }
  return result;

}

main();