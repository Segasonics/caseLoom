import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../api.js";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const res = await signup({ name, email, password });
    if (res.error) {
      setError(res.error);
      return;
    }
    localStorage.setItem("caseloom_user", JSON.stringify(res.user));
    localStorage.setItem("caseloom_token", res.token);
    navigate("/dashboard");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="subtext">Start a new clinical case workspace in minutes.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            Full Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="form-field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="form-field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className="primary">Create Account</button>
        </form>
        <button className="link-button" onClick={() => navigate("/login")}>
          Back to login
        </button>
      </div>
    </div>
  );
}
