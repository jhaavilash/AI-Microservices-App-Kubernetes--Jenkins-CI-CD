const db = require("./db");

function addMonitor(url, interval) {
  db.query(
    "INSERT INTO monitors (url, interval_time, status, response_time) VALUES (?, ?, 'UNKNOWN', 0)",
    [url, interval]
  );
}

function getMonitors(callback) {
  db.query("SELECT * FROM monitors", (err, results) => {
    callback(results);
  });
}

function updateMonitor(id, status, time) {
  db.query(
    "UPDATE monitors SET status=?, response_time=? WHERE id=?",
    [status, time, id]
  );

  db.query(
    "INSERT INTO monitor_logs (monitor_id, status, response_time) VALUES (?, ?, ?)",
    [id, status, time]
  );
}

function getMonitorLogs(callback, limit = 200) {
  db.query(
    "SELECT ml.*, m.url FROM monitor_logs ml JOIN monitors m ON m.id=ml.monitor_id ORDER BY ml.id DESC LIMIT ?",
    [limit],
    (err, results) => {
      if (err) {
        console.error(err);
        return callback([]);
      }
      callback(results);
    }
  );
}

module.exports = { addMonitor, getMonitors, updateMonitor, getMonitorLogs };