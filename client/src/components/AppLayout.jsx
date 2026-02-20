import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api.js";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("caseloom_user") || "null");

  async function handleLogout() {
    await logout();
    localStorage.removeItem("caseloom_user");
    localStorage.removeItem("caseloom_token");
    window.dispatchEvent(new Event("caseloom-auth-changed"));
    navigate("/login");
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>CaseLoom</h1>
          <p>Thread clinical reasoning into a timeline and automate follow-ups.</p>
        </div>
        <div className="hero-actions">
          <div className="hero-badge">
            <span className="hero-label">Workspace</span>
            <span className="hero-value">{user?.role === "admin" ? "Admin" : "Doctor"}</span>
          </div>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-title">Main Navigation</div>
          <Link className={location.pathname === "/dashboard" ? "side-link active" : "side-link"} to="/dashboard">
            Dashboard
          </Link>
          <Link className={location.pathname.startsWith("/cases") ? "side-link active" : "side-link"} to="/cases">
            Case Threads
          </Link>
          <Link className={location.pathname === "/appointments" ? "side-link active" : "side-link"} to="/appointments">
            Appointments
          </Link>
          <Link className={location.pathname === "/appointments/book" ? "side-link active" : "side-link"} to="/appointments/book">
            Book
          </Link>
          <Link className={location.pathname === "/audit-logs" ? "side-link active" : "side-link"} to="/audit-logs">
            Audit Logs
          </Link>
          <button
            className="side-link logout-link mobile-only"
            onClick={handleLogout}
          >
            Log out
          </button>
          <div className="sidebar-divider" />
          <div className="sidebar-user">
            <div className="user-chip">
              <div className="user-initials">{(user?.name || user?.email || "D")[0]}</div>
              <div>
                <div className="user-name">{user?.name || "Doctor"}</div>
                <div className="user-email">{user?.email || "clinic@caseloom.local"}</div>
              </div>
            </div>
            <button
              className="ghost ghost-dark"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
