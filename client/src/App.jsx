import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Appointments from "./pages/Appointments.jsx";
import BookAppointment from "./pages/BookAppointment.jsx";
import AppLayout from "./components/AppLayout.jsx";
import CaseThread from "./pages/CaseThread.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";

export default function App() {
  const [isAuthed, setIsAuthed] = useState(() => Boolean(localStorage.getItem("caseloom_token")));

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthed(Boolean(localStorage.getItem("caseloom_token")));
    };

    window.addEventListener("storage", syncAuthState);
    window.addEventListener("caseloom-auth-changed", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("caseloom-auth-changed", syncAuthState);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={isAuthed ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route element={isAuthed ? <AppLayout /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/book" element={<BookAppointment />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/cases" element={<CaseThread />} />
        <Route path="/cases/:id" element={<CaseThread />} />
      </Route>
    </Routes>
  );
}
