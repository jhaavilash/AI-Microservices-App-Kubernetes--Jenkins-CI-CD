const cron = require("node-cron");
const axios = require("axios");
const { getMonitors, updateMonitor } = require("./monitorStore");
const { sendAlert } = require("./email");

function startMonitoring() {
  cron.schedule("* * * * *", () => {
    getMonitors(async (monitors) => {
      const currentMinute = Math.floor(Date.now() / 60000);

      for (let m of monitors) {
        // interval_time is minutes; run every interval for each monitor
        const interval = Number(m.interval_time || m.interval || 1);
        if (interval <= 0) continue;

        if (currentMinute % interval !== 0) continue;

        try {
          const start = Date.now();
          await axios.get(m.url, { timeout: 25000 });
          const time = Date.now() - start;

          updateMonitor(m.id, "UP", time);
        } catch {
          updateMonitor(m.id, "DOWN", 0);
          sendAlert(m.url);
        }
      }
    });
  });
}

module.exports = { startMonitoring };