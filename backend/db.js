const mysql = require("mysql2");

const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "NewPassword123!";
const dbHost = process.env.DB_HOST || "localhost";
const dbName = process.env.DB_NAME || "monitor_db";

const db = mysql.createConnection({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection error:", err.message);
    return;
  }
  console.log("✅ MySQL Connected", { host: dbHost, user: dbUser, database: dbName });
});

module.exports = db;