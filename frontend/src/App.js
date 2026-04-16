import React, { useState } from "react";
import Login from "./Login";
import BlackDashboardApp from "./BlackDashboardApp";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return loggedIn ? (
    <BlackDashboardApp onLogout={() => setLoggedIn(false)} />
  ) : (
    <Login onLogin={() => setLoggedIn(true)} />
  );
}

export default App;