const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { exec } = require("child_process");
const net = require("net");

const { addMonitor, getMonitors, updateMonitor, getMonitorLogs } = require("./monitorStore");
const { startMonitoring, getSystemMetrics, pingHost, checkPort } = require("./scheduler");

const app = express();
app.use(cors());
app.use(express.json());

const apiRouter = express.Router();
app.use("/api", apiRouter);

/* HEALTH */
apiRouter.get("/health", (req, res) => {
  res.send("Backend running ✅");
});

async function checkAndUpdateMonitor(url, monitorId, type = "HTTP", port = null) {
  const startTs = Date.now();
  const metrics = await getSystemMetrics();
  const monitorType = (type || "HTTP").toUpperCase();

  if (monitorType === "PING") {
    try {
      await pingHost(url);
      const responseTime = Date.now() - startTs;
      updateMonitor(monitorId, "UP", responseTime, metrics);
      return { status: "UP", responseTime, connectionType: "PING" };
    } catch (err) {
      const responseTime = Date.now() - startTs;
      updateMonitor(monitorId, "DOWN", responseTime, metrics);
      throw err;
    }
  }

  if (monitorType === "PORT") {
    try {
      const { status, responseTime } = await checkPort(url, port || 80);
      updateMonitor(monitorId, status, responseTime, metrics);
      return { status, responseTime, connectionType: "PORT" };
    } catch (err) {
      const responseTime = Date.now() - startTs;
      updateMonitor(monitorId, "DOWN", responseTime, metrics);
      throw err;
    }
  }

  // Default HTTP
  try {
    let checkUrl = url;
    if (!/^https?:\/\//i.test(checkUrl)) {
      checkUrl = `http://${checkUrl}`;
    }
    const response = await axios.get(checkUrl, { timeout: 25000, maxRedirects: 5 });
    const responseTime = Date.now() - startTs;
    const statusText = response.status < 400 ? "UP" : "DOWN";
    updateMonitor(monitorId, statusText, responseTime, metrics);
    return { status: statusText, responseTime, statusCode: response.status, connectionType: "HTTP" };
  } catch (err) {
    const responseTime = Date.now() - startTs;
    updateMonitor(monitorId, "DOWN", responseTime, metrics);
    throw err;
  }
}

/* ADD MONITOR */
apiRouter.post("/monitor", (req, res) => {
  const { url, interval, type, port } = req.body;

  if (!url) {
    return res.status(400).send("URL required");
  }

  const monitorType = (type || "HTTP").toUpperCase();

  addMonitor(url, interval || 1, monitorType, port, async (err, insertedId) => {
    if (err) {
      return res.status(500).json({ error: "Could not add monitor" });
    }

    try {
      const result = await checkAndUpdateMonitor(url, insertedId, monitorType, port);
      res.json({ message: "Monitor added and checked", monitorId: insertedId, checkResult: result });
    } catch (checkErr) {
      res.status(201).json({ message: "Monitor added (check failed)", monitorId: insertedId, error: checkErr.message });
    }
  });
});

/* GET MONITORS */
apiRouter.get("/monitors", (req, res) => {
  getMonitors((data) => {
    res.json(data);
  });
});

function pingHost(host) {
  return new Promise((resolve, reject) => {
    let target = host;
    try {
      const hostUrl = new URL(host);
      target = hostUrl.hostname;
    } catch (e) {
      target = host;
    }

    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? `ping -n 1 -w 3000 ${target}`
      : `ping -c 1 -W 3 ${target}`;

    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message || "Ping failed"));
      }
      return resolve(stdout);
    });
  });
}

/* MONITOR CHECK (ping/curl style) */
apiRouter.post("/monitor/check", async (req, res) => {
  let { url, type } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  type = (type || "http").toLowerCase();

  const startTs = Date.now();

  if (type === "ping") {
    try {
      await pingHost(url);
      const responseTime = Date.now() - startTs;
      return res.json({ status: "UP", connectionType: "ping", responseTime });
    } catch (err) {
      const responseTime = Date.now() - startTs;
      return res.status(503).json({ status: "DOWN", connectionType: "ping", error: err.message, responseTime });
    }
  }

  const respondDown = (err) => {
    const responseTime = Date.now() - startTs;
    return { status: "DOWN", connectionType: "http", error: err.message, responseTime };
  };

  const checkHttp = async () => {
    let checkUrl = url;
    if (!/^https?:\/\//i.test(checkUrl)) {
      checkUrl = `http://${checkUrl}`;
    }
    const response = await axios.get(checkUrl, { timeout: 25000, maxRedirects: 5 });
    const responseTime = Date.now() - startTs;
    const statusText = response.status < 400 ? "UP" : "DOWN";
    return { status: statusText, connectionType: "http", statusCode: response.status, responseTime };
  };

  if (type === "auto") {
    try {
      await pingHost(url);
      const responseTime = Date.now() - startTs;
      return res.json({ status: "UP", connectionType: "ping", responseTime });
    } catch (pingErr) {
      try {
        const check = await checkHttp();
        return res.json({ ...check, connectionType: "auto" });
      } catch (httpErr) {
        const responseTime = Date.now() - startTs;
        return res.status(503).json({ status: "DOWN", connectionType: "auto", pingError: pingErr.message, httpError: httpErr.message, responseTime });
      }
    }
  }

  if (type === "ping") {
    try {
      await pingHost(url);
      const responseTime = Date.now() - startTs;
      return res.json({ status: "UP", connectionType: "ping", responseTime });
    } catch (err) {
      const responseTime = Date.now() - startTs;
      return res.status(503).json({ status: "DOWN", connectionType: "ping", error: err.message, responseTime });
    }
  }

  // HTTP check fallback
  try {
    const check = await checkHttp();
    return res.json(check);
  } catch (err) {
    const responseTime = Date.now() - startTs;
    return res.status(503).json({ status: "DOWN", connectionType: "http", error: err.message, responseTime });
  }
});

/* GET MONITOR LOGS */
apiRouter.get("/monitor-logs", (req, res) => {
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