import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Grid,
  Chip,
  TextField,
  Button,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  IconButton,
  Switch,
  FormControlLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper
} from "@mui/material";
import LogoutIcon from '@mui/icons-material/Logout';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

import useMonitors from "./hooks/useMonitors";

function Dashboard({ onLogout }) {
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(1);
  const [monitorType, setMonitorType] = useState("HTTP");
  const [port, setPort] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const alertSoundRef = useRef(null);

  const intervals = [1, 2, 3, 4, 5, 8, 10, 20];

  const { monitors, logs, refresh, error } = useMonitors();

  const filteredLogs = useMemo(() => {
    const fromDate = new Date(dateFrom).setHours(0, 0, 0, 0);
    const toDate = new Date(dateTo).setHours(23, 59, 59, 999);

    return logs
      .filter((log) => {
        const logDate = new Date(log.created_at).getTime();
        return logDate >= fromDate && logDate <= toDate;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [logs, dateFrom, dateTo]);

  const uptimeRangeData = useMemo(() => {
    const dayMap = {};

    filteredLogs.forEach((log) => {
      const day = new Date(log.created_at).toISOString().slice(0, 10);
      if (!dayMap[day]) {
        dayMap[day] = { total: 0, upCount: 0 };
      }
      dayMap[day].total += 1;
      if (log.status === "UP") dayMap[day].upCount += 1;
    });

    return Object.entries(dayMap)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([day, values]) => ({
        date: day,
        uptime: Number(((values.upCount / values.total) * 100).toFixed(2))
      }));
  }, [filteredLogs]);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 250);
      alertSoundRef.current = { audioCtx, oscillator };
    } catch (err) {
      console.error("Sound API not available", err);
    }
  };

  const calculateUptime = (history) => {
    if (!history || history.length === 0) return "0%";
    const up = history.filter((h) => h === "UP").length;
    return ((up / history.length) * 100).toFixed(2) + "%";
  };

  const filteredMonitors = useMemo(() => {
    let list = monitors;
    if (statusFilter !== "ALL") {
      list = list.filter((m) => m.status === statusFilter);
    }
    if (searchText) {
      list = list.filter((m) => m.url.toLowerCase().includes(searchText.toLowerCase()));
    }
    return list;
  }, [monitors, statusFilter, searchText]);

  const groupedMetrics = useMemo(() => {
    const activeMonitors = filteredMonitors.length;
    const totalTrackedHistory = filteredMonitors.flatMap((m) => m.history || []);
    const totalUptime = totalTrackedHistory.length ? calculateUptime(totalTrackedHistory) : "0%";
    const avgResponse =
      filteredMonitors.reduce((acc, m) => acc + (m.response_time || 0), 0) / Math.max(1, activeMonitors);
    const downCount = filteredMonitors.filter((m) => m.status === "DOWN").length;

    const uptimeChartData = filteredMonitors.map((m) => ({
      name: m.url.replace(/https?:\/\//, ""),
      uptime: Number(calculateUptime(m.history).replace("%", "")),
      response: m.response_time || 0
    }));

    return { activeMonitors, totalUptime, avgResponse, downCount, uptimeChartData };
  }, [filteredMonitors]);

  const performanceChartData = useMemo(() => {
    // Group logs by time (every 5 mins or so) for performance charts
    // For simplicity, just use the last 20 logs
    return [...logs]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-20)
      .map(log => ({
        time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cpu: log.cpu_usage || 0,
        mem: log.mem_usage || 0,
        disk: log.disk_usage || 0
      }));
  }, [logs]);

  useEffect(() => {
    const savedFilter = localStorage.getItem("dashboardStatusFilter");
    const savedSearch = localStorage.getItem("dashboardSearchText");
    const savedSound = localStorage.getItem("dashboardSoundEnabled");

    if (savedFilter) setStatusFilter(savedFilter);
    if (savedSearch) setSearchText(savedSearch);
    if (savedSound) setSoundEnabled(savedSound === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboardStatusFilter", statusFilter);
    localStorage.setItem("dashboardSearchText", searchText);
    localStorage.setItem("dashboardSoundEnabled", String(soundEnabled));
  }, [statusFilter, searchText, soundEnabled]);

  useEffect(() => {
    if (error) {
      setSnack({ open: true, message: error, severity: "error" });
    }
  }, [error]);

  useEffect(() => {
    if (groupedMetrics.downCount > 0) {
      setAlertOpen(true);
      if (soundEnabled) playAlertSound();
    }
  }, [groupedMetrics.downCount, soundEnabled]);

  const addMonitor = async () => {
    if (!url.trim()) {
      setSnack({ open: true, message: "Enter URL to add", severity: "warning" });
      return;
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || (window.location.origin + "/api");
      const res = await fetch(`${apiBase}/monitor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          url, 
          interval, 
          type: monitorType,
          port: monitorType === "PORT" ? Number(port) : null 
        })
      });

      const data = await res.json();
      if (!res.ok && res.status !== 201) {
        throw new Error(data.error || "Failed to add monitor");
      }

      setSnack({ open: true, message: data.message || "Monitor added", severity: "success" });
      setUrl("");
      refresh();
    } catch (err) {
      setSnack({ open: true, message: err.message, severity: "error" });
    }
  };

  const testMonitor = async () => {
    if (!url.trim()) {
      setSnack({ open: true, message: "Enter a URL first", severity: "warning" });
      return;
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || (window.location.origin + "/api");
      const response = await fetch(`${apiBase}/monitor/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: checkType })
      });
      const result = await response.json();

      if (response.ok) {
        setSnack({ open: true, message: `Check OK (${result.status}, ${result.responseTime}ms)`, severity: "success" });
      } else {
        setSnack({ open: true, message: `Check failed: ${result.error || result.status}`, severity: "error" });
      }
    } catch (err) {
      setSnack({ open: true, message: `Check error: ${err.message}`, severity: "error" });
    }
  };

  const handleCloseSnack = () => setSnack((prev) => ({ ...prev, open: false }));
  const handleCloseAlert = () => setAlertOpen(false);


  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "#0f172a",
        p: 2,
        backgroundColor: "#f3f6fb",
        backgroundImage: "none",
        backgroundSize: "cover",
        backgroundBlendMode: "normal"
      }}
    >
      <AppBar position="static" sx={{ bgcolor: "#ffffff", boxShadow: "0 4px 14px rgba(20, 28, 55, 0.1)", color: "#0f172a" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, color: "#0f172a" }}>
            📊 Monitoring Dashboard Application
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ mr: 1 }}
            onClick={() => refresh()}
          >
            Refresh Now
          </Button>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ mt: 2, mb: 1, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          label="Search URL"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          sx={{ width: 140 }}
        >
          {['ALL', 'UP', 'DOWN', 'UNKNOWN'].map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>

        <TextField
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          select
          label="Check Type"
          value={checkType}
          onChange={(e) => setCheckType(e.target.value)}
          size="small"
          sx={{ width: 140 }}
        >
          {["http", "ping", "auto"].map((type) => (
            <MenuItem key={type} value={type}>{type.toUpperCase()}</MenuItem>
          ))}
        </TextField>
        <Button variant="text" onClick={() => { setSearchText(''); setStatusFilter('ALL'); }}>
          Clear Filter
        </Button>
        <FormControlLabel
          control={
            <Switch
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="Alert Sound"
        />

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Monitor Type"
                value={monitorType}
                onChange={(e) => setMonitorType(e.target.value)}
                size="small"
              >
                {["HTTP", "PING", "PORT"].map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={monitorType === "PORT" ? "Host / IP" : "Enter URL"}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                size="small"
              />
            </Grid>
            {monitorType === "PORT" && (
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  size="small"
                />
              </Grid>
            )}
            <Grid item xs={12} md={2}>
              <TextField
                select
                fullWidth
                label="Interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                size="small"
              >
                {intervals.map((i) => (
                  <MenuItem key={i} value={i}>{i} min</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={addMonitor}
                sx={{ height: "40px" }}
              >
                Add
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Box sx={{ width: 240, minHeight: "calc(100vh - 100px)", bgcolor: "#ffffff", p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: "#0f172a" }}>
            Dashboard Menu
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              "Monitoring",
              "Incidents",
              "Status pages",
              "Maintenance",
              "Team members",
              "Integrations & API"
            ].map((menu) => (
              <Button
                key={menu}
                variant="text"
                sx={{
                  justifyContent: "flex-start",
                  color: "#0f172a",
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1,
                  '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.15)' }
                }}
              >
                {menu}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: "#ffffff", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)", border: "1px solid #e2e8f0" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Monitors
                  </Typography>
                  <Typography variant="h4">{groupedMetrics.activeMonitors}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: "#ffffff", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)", border: "1px solid #e2e8f0" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    System Uptime
                  </Typography>
                  <Typography variant="h4">{groupedMetrics.totalUptime}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: "#ffffff", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)", border: "1px solid #e2e8f0" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Avg Response (ms)
                  </Typography>
                  <Typography variant="h4">{Math.round(groupedMetrics.avgResponse)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ bgcolor: "#ffffff", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)", border: "1px solid #e2e8f0" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Down Monitors
                  </Typography>
                  <Typography variant="h4" color={groupedMetrics.downCount > 0 ? "error.main" : "success.main"}>
                    {groupedMetrics.downCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mt: 2, bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Uptime Trend (Date-range zoom)
              </Typography>
              <Box sx={{ width: "100%", height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={uptimeRangeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#475569" />
                    <YAxis stroke="#475569" unit="%" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="uptime" stroke="#4caf50" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>CPU Usage %</Typography>
                  <Box sx={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} stroke="#475569" />
                        <Tooltip />
                        <Line type="monotone" dataKey="cpu" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Memory Usage %</Typography>
                  <Box sx={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} stroke="#475569" />
                        <Tooltip />
                        <Line type="monotone" dataKey="mem" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Disk Usage %</Typography>
                  <Box sx={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} stroke="#475569" />
                        <Tooltip />
                        <Line type="monotone" dataKey="disk" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mt: 2, bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monitoring Data
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 280 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Port</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Interval</TableCell>
                      <TableCell>Response</TableCell>
                      <TableCell>Uptime</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMonitors.map((m) => (
                      <TableRow key={`mon-${m.id}`} hover>
                        <TableCell>{m.id}</TableCell>
                        <TableCell>{m.url}</TableCell>
                        <TableCell>
                          <Chip label={m.monitor_type || "HTTP"} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{m.port || "-"}</TableCell>
                        <TableCell>
                          <Chip 
                            label={m.status || "UNKNOWN"} 
                            color={m.status === "UP" ? "success" : "error"} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>{m.interval_time || m.interval || "N/A"}m</TableCell>
                        <TableCell>{m.response_time || "-"}ms</TableCell>
                        <TableCell>{calculateUptime(m.history)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2, bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Typography gutterBottom variant="h6" sx={{ color: "#0f172a", textAlign: 'right' }}>
                    Add monitoring URL
                  </Typography>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Enter URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        sx={{ bgcolor: "#f8fafc", borderRadius: 1 }}
                        InputProps={{ sx: { color: "#0f172a" } }}
                        InputLabelProps={{ sx: { color: "#64748b" } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        select
                        fullWidth
                        label="Interval"
                        sx={{ bgcolor: "#f8fafc", borderRadius: 1 }}
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        InputProps={{ sx: { color: "#0f172a" } }}
                        InputLabelProps={{ sx: { color: "#64748b" } }}
                      >
                        {intervals.map((i) => (
                          <MenuItem key={i} value={i} sx={{ color: "#000" }}>
                            {i} min
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={addMonitor}
                        sx={{ height: "100%" }}
                      >
                        Add Monitor
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ bgcolor: "#ffffff", p: 2, borderRadius: 2, border: "1px solid #e2e8f0" }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Uptime / Response snapshot
                    </Typography>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={groupedMetrics.uptimeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#475569" tick={{ fill: "#475569" }} />
                        <YAxis stroke="#475569" tick={{ fill: "#475569" }} />
                        <Tooltip wrapperStyle={{ color: "#000" }} />
                        <Legend />
                        <Bar dataKey="uptime" name="Uptime %" fill="#4caf50" />
                        <Bar dataKey="response" name="Latency" fill="#2196f3" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            {filteredMonitors.map((m) => (
              <Grid item xs={12} md={6} key={m.id}>
                <Card
                  sx={{ bgcolor: "#ffffff", cursor: "pointer", border: "1px solid #e2e8f0", boxShadow: "0 10px 18px rgba(15, 23, 42, 0.05)" }}
                  onClick={() => setSelectedMonitor(m)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, color: "#0f172a" }}>
                      {m.url}
                    </Typography>

                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={4}>
                        <Chip
                          label={m.status || "UNKNOWN"}
                          color={m.status === "UP" ? "success" : "error"}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body2">{m.response_time} ms</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body2">Uptime: {calculateUptime(m.history)}</Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {m.history?.map((h, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            width: 8,
                            height: 30,
                            backgroundColor: h === "UP" ? "#4caf50" : "#f44336"
                          }}
                        />
                      ))}
                    </Box>

                    <Box sx={{ mt: 2, height: 90 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={m.history?.map((h, i) => ({ name: i, value: h === "UP" ? 100 : 0 }))}
                        >
                          <XAxis dataKey="name" hide />
                          <YAxis domain={[0, 100]} hide />
                          <Line type="monotone" dataKey="value" stroke="#4caf50" dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card sx={{ mt: 2, bgcolor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 18px rgba(15, 23, 42, 0.05)" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Monitor Logs
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 340 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date/Time</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Response (ms)</TableCell>
                      <TableCell>CPU %</TableCell>
                      <TableCell>Mem %</TableCell>
                      <TableCell>Disk %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell>{log.url}</TableCell>
                        <TableCell>{log.status}</TableCell>
                        <TableCell>{log.response_time}</TableCell>
                        <TableCell>{log.cpu_usage ? log.cpu_usage.toFixed(1) : "-"}</TableCell>
                        <TableCell>{log.mem_usage ? log.mem_usage.toFixed(1) : "-"}</TableCell>
                        <TableCell>{log.disk_usage ? log.disk_usage.toFixed(1) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.severity} onClose={handleCloseSnack}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog open={alertOpen} onClose={handleCloseAlert}>
        <DialogTitle>Alert: one or more monitors are down</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {groupedMetrics.downCount} monitors are currently down. Check monitor details.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAlert}>Dismiss</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedMonitor)} onClose={() => setSelectedMonitor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Monitor details</DialogTitle>
        <DialogContent>
          <DialogContentText>
            URL: {selectedMonitor?.url}
          </DialogContentText>
          <DialogContentText>
            Status: {selectedMonitor?.status}
          </DialogContentText>
          <DialogContentText>
            Response: {selectedMonitor?.response_time} ms
          </DialogContentText>
          <DialogContentText>
            Uptime (last 30): {calculateUptime(selectedMonitor?.history)}
          </DialogContentText>
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selectedMonitor?.history?.map((h, idx) => (
              <Box
                key={idx}
                sx={{ width: 8, height: 28, backgroundColor: h === "UP" ? "#4caf50" : "#f44336" }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedMonitor(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;