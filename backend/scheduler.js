const cron = require("node-cron");
const axios = require("axios");
const si = require("systeminformation");
const net = require("net");
const { exec } = require("child_process");
const { getMonitors, updateMonitor } = require("./monitorStore");
const { sendAlert } = require("./email");

const monitorJobs = new Map();

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

function checkPort(host, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const startTs = Date.now();
    socket.setTimeout(5000);
    socket.on('connect', () => {
      const responseTime = Date.now() - startTs;
      socket.destroy();
      resolve({ status: "UP", responseTime });
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error("Timeout"));
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
    socket.connect(port, host);
  });
}

async function getSystemMetrics() {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    return {
      cpu: cpu.currentLoad,
      mem: (mem.active / mem.total) * 100,
      disk: disk[0] ? disk[0].use : 0
    };
  } catch (err) {
    console.error("Error collecting metrics:", err);
    return { cpu: 0, mem: 0, disk: 0 };
  }
}

async function checkMonitor(m) {
  const start = Date.now();
  let status = "DOWN";
  let responseTime = 0;
  const monitorType = (m.monitor_type || "HTTP").toUpperCase();

  try {
    if (monitorType === "PING") {
      await pingHost(m.url);
      status = "UP";
    } else if (monitorType === "PORT") {
      const res = await checkPort(m.url, m.port || 80);
      status = res.status;
    } else {
      let checkUrl = m.url;
      if (!/^https?:\/\//i.test(checkUrl)) checkUrl = `http://${checkUrl}`;
      const res = await axios.get(checkUrl, { timeout: 25000 });
      status = res.status < 400 ? "UP" : "DOWN";
    }
    responseTime = Date.now() - start;
  } catch (err) {
    status = "DOWN";
    responseTime = Date.now() - start;
  }

  const metrics = await getSystemMetrics();
  
  // Check for state change for email alerts
  if (m.status !== status) {
    if (m.status !== "UNKNOWN") {
      sendAlert(m.url, status);
    }
  }

  updateMonitor(m.id, status, responseTime, metrics);
  m.status = status; // Update local reference status
}

function scheduleMonitor(m) {
  if (!m || !m.id) return;

  const interval = Math.max(1, Number(m.interval_time || m.interval || 1));

  if (monitorJobs.has(m.id)) {
    const existing = monitorJobs.get(m.id);
    existing.stop();
    monitorJobs.delete(m.id);
  }

  const cronRule = `*/${interval} * * * *`;
  const task = cron.schedule(cronRule, () => checkMonitor(m));
  monitorJobs.set(m.id, task);
  return task;
}

function refreshSchedules() {
  getMonitors((monitors) => {
    if (!Array.isArray(monitors)) return;
    monitors.forEach((m) => {
      // Initialize status if not present
      if (!m.status) m.status = "UNKNOWN";
      scheduleMonitor(m);
    });
  });
}

function startMonitoring() {
  refreshSchedules();
  cron.schedule("*/1 * * * *", refreshSchedules);
}

module.exports = { startMonitoring, scheduleMonitor, refreshSchedules, getSystemMetrics, pingHost, checkPort };