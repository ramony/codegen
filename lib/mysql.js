import mysql from 'mysql2/promise';

class Mysql {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(this.config);
    } catch (error) {
      console.error('Error connecting to the database:', error);
      throw error;
    }
  }

  async query(sql, values) {
    if (!this.connection) {
      throw new Error('Database connection is not established.');
    }
    try {
      const [rows] = await this.connection.query(sql, values);
      return rows;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  async count(table) {
    let query = `select count(1) as qty from ${table}`;
    const result = await this.query(query, []);
    return result[0].qty;
  }

  async batchInsert(table, fields, data) {
    const fieldsString = fields.join(',')
    let query = `INSERT IGNORE INTO ${table} (${fieldsString}) VALUES ?`;
    const result = await this.query(query, [data]);
    return result;
  }

  /***
   *  Field: 'count',
      Type: 'int',
      Null: 'YES',
      Key: '',
      Default: null,
      Extra: '',
   */
  async querySchema(table) {
    let fields = await this.query(`DESCRIBE ${table}`, []);
    const tableComments = await this.query(`SELECT TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?`, [table]);
    const comment = tableComments?.[0]?.['TABLE_COMMENT'] || '';
    const fieldsComments = await this.query(`SELECT COLUMN_NAME, COLUMN_COMMENT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?`, [table]);
    const fieldCommentMap = Object.fromEntries(fieldsComments.map((it) => [it['COLUMN_NAME'], it['COLUMN_COMMENT']]));
    fields = fields.map(it => {
      const data = {}
      for (const key of Object.keys(it)) {
        data[key.toLowerCase()] = it[key];
      }
      data.comment = fieldCommentMap[data.field] || '';
      return data;
    })
    return { name: table, comment, fields };
  }

  async close() {
    if (this.connection) {
      try {
        await this.connection.end();
      } catch (error) {
        console.error('Error closing the database connection:', error);
        throw error;
      }
    }
  }
}

export default Mysql;