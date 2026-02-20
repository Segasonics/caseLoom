import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const res = await login({ email, password });
      if (res.error) {
        setError(res.error);
        return;
      }
      localStorage.setItem("caseloom_user", JSON.stringify(res.user));
      localStorage.setItem("caseloom_token", res.token);
      navigate("/dashboard");
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="subtext">Sign in to your CaseLoom workspace.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="form-field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className={`primary ${isSubmitting ? "btn-loading" : ""}`} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
        <button className="link-button" onClick={() => navigate("/signup")}>
          Create an account
        </button>
      </div>
    </div>
  );
}
