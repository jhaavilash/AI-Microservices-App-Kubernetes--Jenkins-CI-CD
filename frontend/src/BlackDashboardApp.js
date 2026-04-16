import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./black-dashboard/layouts/Admin/Admin.js";
import ThemeContextWrapper from "./black-dashboard/components/ThemeWrapper/ThemeWrapper";
import BackgroundColorWrapper from "./black-dashboard/components/BackgroundColorWrapper/BackgroundColorWrapper";

import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/black-dashboard-react.css";
import "./assets/demo/demo.css";
import "./assets/css/nucleo-icons.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

function BlackDashboardApp({ onLogout }) {
  return (
    <ThemeContextWrapper>
      <BackgroundColorWrapper>
        <BrowserRouter>
          <Routes>
            <Route path="/admin/*" element={<AdminLayout onLogout={onLogout} />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </BackgroundColorWrapper>
    </ThemeContextWrapper>
  );
}

export default BlackDashboardApp;
