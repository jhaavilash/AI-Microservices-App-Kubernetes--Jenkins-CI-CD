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
  Paper,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
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
  Legend,
} from "recharts";
import useMonitors from "./hooks/useMonitors";

function BlackDashboard({ onLogout }) {
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [checkType, setCheckType] = useState("http");
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const alertSoundRef = useRef(null);

  const intervals = [1, 2, 3, 5, 8, 10, 20];
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
        uptime: Number(((values.upCount / values.total) * 100).toFixed(2)),
      }));
  }, [filteredLogs]);

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
      response: m.response_time || 0,
    }));

    return { activeMonitors, totalUptime, avgResponse, downCount, uptimeChartData };
  }, [filteredMonitors]);

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
      if (soundEnabled) {
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
      }
    }
  }, [groupedMetrics.downCount, soundEnabled]);

  const addMonitor = async () => {
    if (!url.trim()) {
      setSnack({ open: true, message: "Enter URL to add", severity: "warning" });
      return;
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${apiBase}/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, interval, type: checkType }),
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
      const apiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${apiBase}/monitor/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: checkType }),
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
    <Box sx={{ minHeight: "100vh", bgcolor: "#0b1220", color: "#e2e8f0" }}>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <Box sx={{ display: { xs: "none", md: "block" }, width: 280, bgcolor: "#111827", borderRight: "1px solid #1f2937", p: 3 }}>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, color: "#f8fafc" }}>
            Black Dashboard
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: "#94a3b8" }}>
            Inspired by the official Black Dashboard React theme.
          </Typography>
          <Typography
            component="a"
            href="https://github.com/creativetimofficial/black-dashboard-react.git"
            target="_blank"
            rel="noreferrer"
            sx={{ display: 'block', mb: 3, color: '#60a5fa', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            github.com/creativetimofficial/black-dashboard-react
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {["Overview", "Monitors", "Analytics", "Alerts", "Logs", "Settings"].map((item, index) => (
              <Button
                key={item}
                fullWidth
                variant={index === 0 ? "contained" : "text"}
                sx={{
                  justifyContent: "flex-start",
                  color: index === 0 ? '#f8fafc' : '#cbd5e1',
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  bgcolor: index === 0 ? '#1f2937' : 'transparent',
                  '&:hover': { bgcolor: '#1f2937' },
                }}
              >
                {item}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ width: "100%" }}>
          <AppBar position="sticky" sx={{ bgcolor: "#111827", borderBottom: "1px solid #1f2937", boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }}>
            <Toolbar sx={{ px: { xs: 2, md: 4 } }}>
              <Typography variant="h6" sx={{ flexGrow: 1, color: "#f8fafc" }}>
                📊 Monitoring Dashboard
              </Typography>
              <Button
                variant="contained"
                onClick={() => refresh()}
                sx={{
                  mr: 1,
                  bgcolor: '#2563eb',
                  color: '#f8fafc',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                Refresh
              </Button>
              <IconButton onClick={onLogout} sx={{ color: '#f8fafc' }}>
                <LogoutIcon />
              </IconButton>
            </Toolbar>
          </AppBar>

          <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', minHeight: 130 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>
                      Total Monitors
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#f8fafc', mt: 1 }}>
                      {groupedMetrics.activeMonitors}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', minHeight: 130 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>
                      System Uptime
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#34d399', mt: 1 }}>
                      {groupedMetrics.totalUptime}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', minHeight: 130 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>
                      Avg Response
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#60a5fa', mt: 1 }}>
                      {Math.round(groupedMetrics.avgResponse)} ms
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', minHeight: 130 }}>
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>
                      Down Monitors
                    </Typography>
                    <Typography variant="h4" sx={{ color: groupedMetrics.downCount > 0 ? '#f97316' : '#34d399', mt: 1 }}>
                      {groupedMetrics.downCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#f8fafc', mb: 2 }}>
                  Uptime Trend
                </Typography>
                <Box sx={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={uptimeRangeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #1f2937', color: '#f8fafc' }} />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Line type="monotone" dataKey="uptime" stroke="#34d399" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#f8fafc', mb: 2 }}>
                  Monitoring Controls
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={7}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Search URL"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            bgcolor: '#0b1220',
                            borderRadius: 2,
                            input: { color: '#f8fafc' },
                            label: { color: '#94a3b8' },
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          select
                          fullWidth
                          label="Status"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            bgcolor: '#0b1220',
                            borderRadius: 2,
                            label: { color: '#94a3b8' },
                          }}
                        >
                          {['ALL', 'UP', 'DOWN', 'UNKNOWN'].map((s) => (
                            <MenuItem key={s} value={s} sx={{ color: '#f8fafc' }}>
                              {s}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          label="From"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            bgcolor: '#0b1220',
                            borderRadius: 2,
                            input: { color: '#f8fafc' },
                            label: { color: '#94a3b8' },
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          label="To"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            bgcolor: '#0b1220',
                            borderRadius: 2,
                            input: { color: '#f8fafc' },
                            label: { color: '#94a3b8' },
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          select
                          fullWidth
                          label="Check Type"
                          value={checkType}
                          onChange={(e) => setCheckType(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            bgcolor: '#0b1220',
                            borderRadius: 2,
                            label: { color: '#94a3b8' },
                          }}
                        >
                          {["http", "ping", "auto"].map((type) => (
                            <MenuItem key={type} value={type} sx={{ color: '#f8fafc' }}>
                              {type.toUpperCase()}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setSearchText("");
                            setStatusFilter("ALL");
                          }}
                          sx={{
                            color: '#f8fafc',
                            borderColor: '#334155',
                            '&:hover': { borderColor: '#475569', bgcolor: '#111827' },
                          }}
                        >
                          Clear Filter
                        </Button>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} color="success" />
                          }
                          label="Alert Sound"
                          sx={{ color: '#f8fafc' }}
                        />
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12} md={5}>
                    <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1f2937', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ color: '#f8fafc', mb: 1 }}>
                          Add Monitor
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Monitor URL"
                              value={url}
                              onChange={(e) => setUrl(e.target.value)}
                              size="small"
                              InputLabelProps={{ shrink: true }}
                              sx={{
                                bgcolor: '#0b1220',
                                borderRadius: 2,
                                input: { color: '#f8fafc' },
                                label: { color: '#94a3b8' },
                              }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              select
                              fullWidth
                              label="Interval"
                              value={interval}
                              onChange={(e) => setInterval(Number(e.target.value))}
                              size="small"
                              InputLabelProps={{ shrink: true }}
                              sx={{
                                bgcolor: '#0b1220',
                                borderRadius: 2,
                                label: { color: '#94a3b8' },
                              }}
                            >
                              {intervals.map((i) => (
                                <MenuItem key={i} value={i} sx={{ color: '#f8fafc' }}>
                                  {i} min
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid item xs={12}>
                            <Button
                              fullWidth
                              variant="contained"
                              onClick={addMonitor}
                              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
                            >
                              Add Monitor
                            </Button>
                          </Grid>
                          <Grid item xs={12}>
                            <Button
                              fullWidth
                              variant="outlined"
                              onClick={testMonitor}
                              sx={{
                                color: '#f8fafc',
                                borderColor: '#334155',
                                '&:hover': { borderColor: '#475569', bgcolor: '#111827' },
                              }}
                            >
                              Test Monitor
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#f8fafc', mb: 2 }}>
                  Current Monitors
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: '#0b1220', maxHeight: 320 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>ID</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>URL</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Status</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Interval</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Response</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Uptime</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMonitors.map((m) => (
                        <TableRow key={`mon-${m.id}`} hover sx={{ '&:hover': { bgcolor: '#111827' } }}>
                          <TableCell>{m.id}</TableCell>
                          <TableCell>{m.url}</TableCell>
                          <TableCell>{m.status || 'UNKNOWN'}</TableCell>
                          <TableCell>{m.interval_time || m.interval || 'N/A'}</TableCell>
                          <TableCell>{m.response_time || '-'}</TableCell>
                          <TableCell>{calculateUptime(m.history)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            <Grid container spacing={3} sx={{ mt: 3 }}>
              {filteredMonitors.map((m) => (
                <Grid item xs={12} md={6} key={m.id}>
                  <Card
                    sx={{
                      bgcolor: '#111827',
                      border: '1px solid #1f2937',
                      boxShadow: '0 24px 45px rgba(0,0,0,0.14)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedMonitor(m)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ color: '#f8fafc', mb: 1 }}>
                        {m.url}
                      </Typography>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={4}>
                          <Chip
                            label={m.status || 'UNKNOWN'}
                            color={m.status === 'UP' ? 'success' : 'error'}
                            sx={{ bgcolor: '#1f2937', color: '#f8fafc' }}
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                            {m.response_time} ms
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                            Uptime: {calculateUptime(m.history)}
                          </Typography>
                        </Grid>
                      </Grid>
                      <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {m.history?.map((h, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              width: 10,
                              height: 28,
                              borderRadius: 1,
                              backgroundColor: h === 'UP' ? '#34d399' : '#f87171',
                            }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card sx={{ bgcolor: '#111827', border: '1px solid #1f2937', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', mt: 3, mb: 4 }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#f8fafc', mb: 2 }}>
                  Recent Monitor Logs
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: '#0b1220', maxHeight: 360 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Date/Time</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>URL</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Status</TableCell>
                        <TableCell sx={{ color: '#cbd5e1', bgcolor: '#111827' }}>Response (ms)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: '#111827' } }}>
                          <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell>{log.url}</TableCell>
                          <TableCell>{log.status}</TableCell>
                          <TableCell>{log.response_time}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={handleCloseSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
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
          <DialogContentText>URL: {selectedMonitor?.url}</DialogContentText>
          <DialogContentText>Status: {selectedMonitor?.status}</DialogContentText>
          <DialogContentText>Response: {selectedMonitor?.response_time} ms</DialogContentText>
          <DialogContentText>Uptime (last 30): {calculateUptime(selectedMonitor?.history)}</DialogContentText>
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedMonitor?.history?.map((h, idx) => (
              <Box key={idx} sx={{ width: 8, height: 28, backgroundColor: h === 'UP' ? '#34d399' : '#f87171' }} />
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

export default BlackDashboard;
