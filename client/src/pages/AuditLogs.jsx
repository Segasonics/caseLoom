import React, { useEffect, useState } from "react";
import { fetchAuditLogs } from "../api.js";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [actorEmail, setActorEmail] = useState("");

  async function load() {
    setLoading(true);
    const data = await fetchAuditLogs({
      entityType: entityType || undefined,
      actorEmail: actorEmail || undefined,
      limit: 200
    });
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="card">
        <div className="section-header">
          <h2>Audit Logs</h2>
          <span className="section-pill">{logs.length}</span>
        </div>
        <div className="audit-filters">
          <input
            className="input-ghost"
            placeholder="Filter by actor email"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
          />
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All entities</option>
            <option value="case">Case</option>
            <option value="timeline_event">Timeline Event</option>
            <option value="decision_point">Decision Point</option>
            <option value="task">Task</option>
            <option value="appointment">Appointment</option>
            <option value="attachment">Attachment</option>
          </select>
          <button className="ghost-dark" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="case-empty">No audit events found.</div>
        ) : (
          <ul className="thread-list">
            {logs.map((log) => (
              <li key={log._id} className="thread-item">
                <div className="thread-title">
                  <span className="thread-kind">{log.action}</span>
                  <span className="thread-date">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div className="thread-body">
                  {log.entityType} · {log.entityId || "n/a"}
                </div>
                <div className="thread-next">
                  By: {log.actorEmail || "anonymous"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
