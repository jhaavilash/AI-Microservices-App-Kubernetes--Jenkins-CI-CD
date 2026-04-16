import { useEffect, useMemo, useState, useCallback } from "react";

export default function useMonitors() {
  const [monitors, setMonitors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE_URL || (window.location.origin + "/api");

  const fetchJson = useCallback(async (url) => {
    const headers = { "Content-Type": "application/json" };

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    return res.json();
  }, []);

  const loadMonitors = useCallback(async () => {
    try {
      const data = await fetchJson(`${API_BASE}/monitors`);
      setMonitors(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchJson, API_BASE]);

  const loadLogs = useCallback(async () => {
    try {
      const data = await fetchJson(`${API_BASE}/monitor-logs`);
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchJson, API_BASE]);

  const refresh = useCallback(async () => {
    await Promise.all([loadMonitors(), loadLogs()]);
  }, [loadMonitors, loadLogs]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const groupedHistory = useMemo(() => {
    return monitors.map((m) => {
      const monitorLogs = logs
        .filter((log) => log.monitor_id === m.id)
        .slice(0, 30)
        .map((log) => log.status || "UNKNOWN");

      return {
        ...m,
        history: monitorLogs.length > 0 ? monitorLogs : m.history || []
      };
    });
  }, [monitors, logs]);

  return {
    monitors: groupedHistory,
    logs,
    refresh,
    error
  };
}
