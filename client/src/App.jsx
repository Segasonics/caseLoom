import React from "react";
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
  const isAuthed = Boolean(localStorage.getItem("caseloom_user"));

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
