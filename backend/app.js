const express = require("express");
const cors = require("cors");

const { addMonitor, getMonitors, getMonitorLogs } = require("./monitorStore");
const { startMonitoring } = require("./scheduler");

const app = express();
app.use(cors());
app.use(express.json());

/* HEALTH */
app.get("/health", (req, res) => {
  res.send("Backend running ✅");
});

/* ADD MONITOR */
app.post("/monitor", (req, res) => {
  const { url, interval } = req.body;

  if (!url) {
    return res.status(400).send("URL required");
  }

  addMonitor(url, interval || 1);
  res.send("Monitor added ✅");
});

/* GET MONITORS */
app.get("/monitors", (req, res) => {
  getMonitors((data) => {
    res.json(data);
  });
});

/* GET MONITOR LOGS */
app.get("/monitor-logs", (req, res) => {
  getMonitorLogs((data) => {
    res.json(data);
  });
});

/* START MONITORING */
startMonitoring();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});