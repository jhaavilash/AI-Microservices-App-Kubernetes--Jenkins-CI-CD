const db = require("./db");

function addMonitor(url, interval, type = 'HTTP', port = null, callback) {
  db.query(
    "INSERT INTO monitors (url, interval_time, monitor_type, port, status, response_time) VALUES (?, ?, ?, ?, 'UNKNOWN', 0)",
    [url, interval, type, port],
    (err, result) => {
      if (err) {
        console.error(err);
        if (callback) callback(err);
        return;
      }
      if (callback) callback(null, result.insertId);
    }
  );
}

function getMonitors(callback) {
  db.query("SELECT * FROM monitors", (err, results) => {
    callback(results);
  });
}

function updateMonitor(id, status, time, metrics = {}) {
  const { cpu = 0, mem = 0, disk = 0 } = metrics;
  db.query(
    "UPDATE monitors SET status=?, response_time=? WHERE id=?",
    [status, time, id]
  );

  db.query(
    "INSERT INTO monitor_logs (monitor_id, status, response_time, cpu_usage, mem_usage, disk_usage) VALUES (?, ?, ?, ?, ?, ?)",
    [id, status, time, cpu, mem, disk]
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