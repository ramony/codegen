const mysql = require('mysql2');
const fs = require('fs');

// 从 JSON 文件读取 MySQL 配置
const readConfig = () => {
  try {
    const data = fs.readFileSync('database.json', 'utf8');
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
const getColumns = (connection, table) => {
  return new Promise((resolve, reject) => {
    connection.query(`DESCRIBE ${table}`, (err, results) => {
      if (err) {
        console.error(`获取表 ${table} 的字段结构失败:`);
        resolve(null);
      } else {
        const columns = results.map(row => ({
          field: row.Field,
          type: row.Type,
          isnull: row.Null,
          key: row.Key,
          def: row.Default,
          extra: row.Extra
        }));
        resolve(columns);
      }
    });
  });
};

const main = async () => {
  const tableNames = process.argv.slice(2);
  if (tableNames.length == 0) {
    console.log(`需要指定表名`);
    return;
  }
  const config = readConfig();
  const connection = connectToDatabase(config);

  const tables = [];
  try {

    for (const tableName of tableNames) {
      const table = { name: tableName, columns: [] }
      //console.log(`表名: ${tableName}`);
      const columns = await getColumns(connection, tableName);
      columns?.forEach(column => {
        table.columns.push(column)
        //console.log(`  字段名: ${column.Field}, 类型: ${column.Type}, 是否可为空: ${column.Null}, 键类型: ${column.Key}, 默认值: ${column.Default}, 额外信息: ${column.Extra}`);
      });
      tables.push(table)
      //console.log('-' * 50);
    }
    console.log(JSON.stringify(tables, 4, 1))
  } catch (err) {
    console.error('发生错误:');
  } finally {
    connection.end();
  }
};

main();