const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'mysql-service',
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'sentiment_db'
});

module.exports = connection;