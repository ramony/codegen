import path from 'path';
import Mysql from './lib/mysql.js';
import io from './lib/io.js';
import typeMapping from './lib/typeMapping.js';
import velocityjs from 'velocityjs';
import settings from './settings.js';

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
  const taskConfigPath = path.join("config", "task.yaml");
  let [taskConfig, taskConfigExist] = io.tryReadYAML(taskConfigPath);
  if (!taskConfigExist) {
    io.mkdir("config");
    io.writeYAML(taskConfigPath, settings.taskExample)
    console.error(`已生成task配置文件: ${taskConfigPath}，请先修改`);
    return;
  }

  const templatePath = path.join("config/templates", taskConfig.templateName);
  let templateExist = io.exists(templatePath);
  if (!templateExist) {
    io.mkdir(templatePath);
    console.error(`已生成模版配置文件夹: ${taskConfigPath}，请先修改`);
    for (const key in settings.templateExample) {
      const testVmFile = path.join(templatePath, key + ".vm")
      io.write(testVmFile, settings.templateExample[key]);
    }
    return;
  }

  const db = new Mysql(taskConfig.database);
  await db.connect();
  const tablesInfo = await loadTables(db, taskConfig.tableNames);
  await db.close();

  const vmFiles = listFile(templatePath).filter((file) => path.extname(file) === '.vm');
  let globalCotent = null;
  const templates = []
  for (const vmFile of vmFiles) {
    let vmContent = readFile(path.join(templatePath, vmFile));
    if (vmFile == 'global.vm') {
      globalCotent = vmContent;
    } else {
      templates.push({ vmFile, vmContent })
    }
  }

  if (globalCotent) {
    templates.forEach(t => {
      t.vmContent = globalCotent + '\n\n' + t.vmContent;
    })
  }

  for (const tableInfo of tablesInfo) {
    console.log(`\n开始处理表:${tableInfo.name}`)
    for (const template of templates) {
      const context = dbToJava(tableInfo, typeMapping, taskConfig);
      context.save = (fileName) => {
        context.dist = fileName;
      }
      context.package = (pkg) => {
        return "package " + taskConfig.prefixPackage + "." + pkg + ";";
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
      writeFile(path.join(taskConfig.dist, taskConfig.prefixPackage.replace(/\./g, '/'), context.dist), output);
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

function dbToJava(tableInfo, typeMapping, taskConfig) {
  const { name } = tableInfo;
  const { author, preSet } = taskConfig;
  const nameShort = name.replace(/^t_/, "");
  const Table = convertToCamelCase(nameShort);
  const table = lowerCaseFirstLetter(Table);
  const tablepath = convertToCamelCase(nameShort.split("_").slice(0, 2).join("_")).toLowerCase();
  const tableComment = tableInfo.comment;
  const tableFields = tableInfo.fields.map(col => {
    const name = col.field;
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
    return { ...col, name, Field, field, fullType, type, fieldComment, setField, getField }
  })

  const datetime = new Date().toLocaleString()
  const result = { ...defaultContext, name, Table, table, tableComment, tablepath, tableFields, author, datetime };
  for (const pre of preSet) {
    result["table" + pre] = table + pre;
    result["Table" + pre] = Table + pre;
  }
  return result;

}

main();