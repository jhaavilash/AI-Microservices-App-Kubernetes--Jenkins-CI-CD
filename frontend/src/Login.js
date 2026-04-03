import React, { useState } from "react";
import {
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  Snackbar,
  Alert,
  LinearProgress,
  InputAdornment,
  IconButton
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!user || !pass) {
      setError("Please fill both fields.");
      setOpen(true);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (user === "admin" && pass === "admin") {
        onLogin();
      } else {
        setError("Invalid username or password");
        setOpen(true);
      }
    }, 600);
  };

  const handleClose = () => setOpen(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(circle at top left, #3b82f6, #0f172a 60%)",
        color: "white",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "url('https://images.unsplash.com/photo-1593642634443-44adaa06623a?auto=format&fit=crop&w=1950&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.22,
          filter: "blur(2px)",
          zIndex: 0
        }}
      />

      <Card
        sx={{
          width: [320, 380, 440],
          zIndex: 1,
          borderRadius: 3,
          bgcolor: "rgba(255, 255, 255, 0.9)",
          color: "#0f172a",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
          transition: "transform 0.3s ease",
          '&:hover': { transform: 'translateY(-6px)' }
        }}
      >
        <CardContent sx={{ px: 4, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" align="center" sx={{ fontWeight: 700, mb: 0.5 }}>
              Welcome back!
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: "#94a3b8" }}>
              Secure monitoring dashboard with real-time insights.
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            variant="outlined"
            InputProps={{ sx: { color: "#0f172a" } }}
            InputLabelProps={{ sx: { color: "#64748b" } }}
            sx={{ mb: 2, bgcolor: "#f8fafc", borderRadius: 1 }}
          />

          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            label="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            variant="outlined"
            InputProps={{
              sx: { color: "#0f172a" },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((show) => !show)}
                    edge="end"
                    sx={{ color: "#64748b" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            InputLabelProps={{ sx: { color: "#64748b" } }}
            sx={{ mb: 2, bgcolor: "#f8fafc", borderRadius: 1 }}
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleLogin}
            disabled={loading}
            sx={{ py: 1.5, fontWeight: 700, letterSpacing: 0.6 }}
          >
            {loading ? "Logging in..." : "Log In"}
          </Button>

          {loading && <LinearProgress sx={{ mt: 2, bgcolor: "rgba(255,255,255,0.15)" }} />}

          <Snackbar open={open} autoHideDuration={3000} onClose={handleClose} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
            <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
              {error}
            </Alert>
          </Snackbar>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Login;