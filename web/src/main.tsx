import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import "./theme.css";
import { LeavesLogo } from "./components/LeavesLogo";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import LogVisitPage from "./pages/LogVisitPage";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import OwnerDashboard from "./pages/OwnerDashboard";

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "0.88rem",
  color: isActive ? "var(--leaves-green-900)" : "var(--color-text-muted)",
  background: isActive ? "var(--leaves-green-100)" : "transparent",
});

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LeavesLogo />
          <div>
            <div style={{ fontWeight: 700, color: "var(--leaves-green-900)", lineHeight: 1.1 }}>Leaves</div>
            <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>Maintenance System</div>
          </div>
        </div>

        {user && (
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NavLink to="/clients" style={navLinkStyle}>Clients</NavLink>
            <NavLink to="/visits/new" style={navLinkStyle}>Log a Visit</NavLink>
            {["supervisor", "head_of_maintenance", "maintenance_manager", "owner"].includes(user.role) && (
              <NavLink to="/dashboard/supervisor" style={navLinkStyle}>Supervisor</NavLink>
            )}
            {user.role === "owner" && (
              <NavLink to="/dashboard/owner" style={navLinkStyle}>Owner</NavLink>
            )}
            <div style={{ width: 1, height: 24, background: "var(--color-border)", margin: "0 4px" }} />
            <div style={{ textAlign: "right", marginRight: 4 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                {user.role.replace(/_/g, " ")}
              </div>
            </div>
            <button onClick={handleLogout} style={{ background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main style={{ padding: 24, maxWidth: 1080, margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/clients" element={<RequireAuth><ClientsPage /></RequireAuth>} />
          <Route path="/clients/:id" element={<RequireAuth><ClientDetailPage /></RequireAuth>} />
          <Route path="/visits/new" element={<RequireAuth><LogVisitPage /></RequireAuth>} />
          <Route
            path="/dashboard/supervisor"
            element={
              <RequireAuth roles={["supervisor", "head_of_maintenance", "maintenance_manager", "owner"]}>
                <SupervisorDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/owner"
            element={
              <RequireAuth roles={["owner"]}>
                <OwnerDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
