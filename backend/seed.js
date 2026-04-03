const mysql = require("mysql2");

const host = process.env.DB_HOST || "localhost";
const user = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "NewPassword123!";

const connection = mysql.createConnection({
  host,
  user,
  password,
  multipleStatements: true
});

const initSql = `
CREATE DATABASE IF NOT EXISTS monitor_db;
USE monitor_db;

CREATE TABLE IF NOT EXISTS monitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  interval_time INT NOT NULL,
  status ENUM('UNKNOWN','UP','DOWN') DEFAULT 'UNKNOWN',
  response_time INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitor_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  monitor_id INT NOT NULL,
  status ENUM('UNKNOWN','UP','DOWN') NOT NULL,
  response_time INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

INSERT INTO monitors (url, interval_time, status, response_time)
VALUES
  ('https://www.google.com', 1, 'UNKNOWN', 0),
  ('https://www.github.com', 2, 'UNKNOWN', 0)
ON DUPLICATE KEY UPDATE url=url;
`; 

connection.query(initSql, (err, results) => {
  if (err) {
    console.error("DB seed failed", err);
    process.exit(1);
  }
  console.log("DB seed completed");
  connection.end();
});
