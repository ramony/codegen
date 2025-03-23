const fs = require('fs');
const path = require('path');

// 读取模板文件
function readFile(fileName) {
  const content = fs.readFileSync(fileName, 'utf8');
  return content;
}

function listFile(dir) {
  try {
    // 读取指定目录下的所有文件和文件夹
    const files = fs.readdirSync(dir);
    return files;
  } catch (err) {
    console.error('读取目录时出现错误:', err);
  }
}

function writeFile(filePathName, data) {
  const filePath = path.dirname(filePathName);
  // 创建目录
  fs.mkdirSync(filePath, { recursive: true });
  // 目录创建成功后，写入文件
  fs.writeFileSync(filePathName, data);
}

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

module.exports = { readFile, readJsonFile, writeFile, listFile }