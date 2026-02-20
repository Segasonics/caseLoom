import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import TimelineEventForm from "./TimelineEventForm.jsx";
import DecisionPointForm from "./DecisionPointForm.jsx";
import TaskForm from "./TaskForm.jsx";
import { visitTemplates } from "../data/visitTemplates.js";
import { updateCaseTags } from "../api.js";
import {
  uploadCaseAttachment,
  deleteCaseAttachment,
  fetchCaseAttachmentUrl,
} from "../api.js";
import { fetchCaseShares, shareCaseWithEmail, unshareCaseUser } from "../api.js";

export default function CaseDetail({
  data,
  onAddTimeline,
  onAddDecisionPoint,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onCloseCase,
  onReopenCase,
  onDeleteCase,
  onRefresh,
  decisionPrefill
}) {
  if (!data) {
    return (
      <div className="empty empty-card">
        <div className="empty-icon">CaseLoom</div>
        <h3>Choose a case to begin</h3>
        <p className="subtext">
          Select an active case on the left to view the timeline, decisions, and appointments.
        </p>
      </div>
    );
  }

  const { case: item, timeline, decisions, tasks = [], appointments = [], attachments = [] } = data;
  const [tagsInput, setTagsInput] = useState((item.tags || []).join(", "));
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareState, setShareState] = useState({ owner: null, sharedUsers: [] });
  const [selectedTemplateId, setSelectedTemplateId] = useState(visitTemplates[0].id);
  const selectedTemplate =
    visitTemplates.find((template) => template.id === selectedTemplateId) || visitTemplates[0];
  const [templateText, setTemplateText] = useState(selectedTemplate.body);
  const currentUser = JSON.parse(localStorage.getItem("caseloom_user") || "null");
  const ownerId = typeof item.ownerId === "string" ? item.ownerId : item.ownerId?._id;
  const isAdmin = currentUser?.role === "admin";
  const isOwner = Boolean(ownerId && currentUser?.id === ownerId);
  const canManageShare = isAdmin || isOwner;

  useEffect(() => {
    setTagsInput((item.tags || []).join(", "));
    setShareOpen(false);
    setShareEmail("");
    setShareState({ owner: null, sharedUsers: [] });
  }, [item._id]);

  async function loadShareState() {
    setShareLoading(true);
    const res = await fetchCaseShares(item._id);
    if (res.error) {
      toast.error(res.error);
    } else {
      setShareState({
        owner: res.owner || null,
        sharedUsers: Array.isArray(res.sharedUsers) ? res.sharedUsers : []
      });
    }
    setShareLoading(false);
  }

  function handleTemplateChange(nextId) {
    setSelectedTemplateId(nextId);
    const nextTemplate =
      visitTemplates.find((template) => template.id === nextId) || visitTemplates[0];
    setTemplateText(nextTemplate.body);
  }

  function formatDateTime(value) {
    if (!value) return "Not provided";
    return new Date(value).toLocaleString();
  }

  function formatDate(value) {
    if (!value) return "Not provided";
    return new Date(value).toLocaleDateString();
  }

  function buildVisitNote() {
    const lines = [];
    lines.push("CaseLoom Visit Note");
    lines.push("");
    lines.push(`Case Title: ${item.title}`);
    lines.push(`Patient Alias: ${item.patientAlias}`);
    lines.push(`Status: ${item.status}`);
    lines.push(`Created At: ${formatDateTime(item.createdAt)}`);
    lines.push("");
    lines.push("Summary:");
    lines.push(item.summary || "Not provided");
    lines.push("");
    lines.push("Timeline:");
    if (timeline.length === 0) {
      lines.push("No timeline events recorded.");
    } else {
      timeline.forEach((event, index) => {
        lines.push(
          `${index + 1}. ${event.kind.toUpperCase()} — ${formatDateTime(event.occurredAt)}`
        );
        lines.push(`   ${event.description}`);
      });
    }
    lines.push("");
    lines.push("Decision Points:");
    if (decisions.length === 0) {
      lines.push("No decision points recorded.");
    } else {
      decisions.forEach((decision, index) => {
        lines.push(`${index + 1}. ${decision.decisionType}`);
        lines.push(`   Rationale: ${decision.rationale}`);
        lines.push(`   Next Step: ${decision.nextStep}`);
        if (decision.followUpBy) {
          lines.push(`   Follow-Up By: ${formatDate(decision.followUpBy)}`);
        }
      });
    }
    lines.push("");
    lines.push("Task Queue:");
    if (tasks.length === 0) {
      lines.push("No tasks recorded.");
    } else {
      tasks.forEach((task, index) => {
        const due = task.dueAt ? ` (Due ${formatDate(task.dueAt)})` : "";
        lines.push(`${index + 1}. [${task.status}] ${task.title}${due}`);
      });
    }
    lines.push("");
    lines.push("Appointments:");
    if (appointments.length === 0) {
      lines.push("No appointments linked.");
    } else {
      appointments.forEach((appointment, index) => {
        lines.push(
          `${index + 1}. ${appointment.title} — ${formatDateTime(appointment.scheduledFor)}`
        );
        lines.push(`   Patient: ${appointment.patientAlias || item.patientAlias}`);
        if (appointment.contactPhone) {
          lines.push(`   SMS: ${appointment.contactPhone}`);
        }
        lines.push(`   Status: ${appointment.status}`);
        if (appointment.notes) {
          lines.push(`   Notes: ${appointment.notes}`);
        }
      });
    }
    return lines.join("\n");
  }

  function handleExportNote() {
    const note = buildVisitNote();
    const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `caseloom-visit-note-${item._id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrintNote() {
    window.print();
  }

  async function handleInsertTemplate() {
    if (!templateText.trim()) {
      toast.error("Template is empty.");
      return;
    }
    await onAddTimeline({
      kind: "note",
      description: `${selectedTemplate.title}\n\n${templateText}`,
      occurredAt: new Date().toISOString()
    });
    toast.success("Added to timeline.");
  }

  async function handleSaveTags() {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await updateCaseTags(item._id, tags);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Tags updated.");
  }

  async function handleAttachmentUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const res = await uploadCaseAttachment(item._id, file);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Attachment uploaded.");
    await onAddTimeline({
      kind: "note",
      description: `Attachment uploaded: ${file.name}`,
      occurredAt: new Date().toISOString()
    });
    if (onRefresh) await onRefresh();
  }

  async function handleDeleteAttachment(attachmentId) {
    const res = await deleteCaseAttachment(item._id, attachmentId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Attachment deleted.");
    if (onRefresh) await onRefresh();
  }

  async function handleViewAttachment(attachmentId) {
    // Ask backend for a short-lived signed URL before opening the file.
    const res = await fetchCaseAttachmentUrl(item._id, attachmentId);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleToggleSharePanel() {
    const next = !shareOpen;
    setShareOpen(next);
    if (next) {
      await loadShareState();
    }
  }

  async function handleShareCase() {
    const email = shareEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter email to share.");
      return;
    }
    setShareSubmitting(true);
    const res = await shareCaseWithEmail(item._id, email);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Case access shared.");
      setShareEmail("");
      await loadShareState();
      if (onRefresh) await onRefresh();
    }
    setShareSubmitting(false);
  }

  async function handleUnshare(userId) {
    setShareSubmitting(true);
    const res = await unshareCaseUser(item._id, userId);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Access removed.");
      await loadShareState();
      if (onRefresh) await onRefresh();
    }
    setShareSubmitting(false);
  }

  return (
    <div className="case-detail">
      <header className="case-header">
        <div>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
          <div className="case-tags">
            <label className="form-field">
              Tags
              <div className="tag-input-row">
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="cardio, urgent, follow-up"
                />
                <button type="button" className="ghost-dark" onClick={handleSaveTags}>
                  Save
                </button>
              </div>
              <span className="hint">Comma-separated tags.</span>
            </label>
          </div>
        </div>
        <div className="case-meta">
          <span className="pill">Case {item.status}</span>
          <span className="muted">{item.patientAlias}</span>
          <div className="case-actions">
            <button className="ghost-dark no-print" onClick={handlePrintNote}>Print Visit Note</button>
            <button className="ghost-dark" onClick={handleExportNote}>Export Visit Note</button>
            <button className="ghost-dark" onClick={handleToggleSharePanel}>
              {shareOpen ? "Hide Share" : "Share Case"}
            </button>
            {item.status !== "closed" ? (
              <button className="ghost-dark" onClick={onCloseCase}>Close Case</button>
            ) : (
              <button className="ghost-dark" onClick={onReopenCase}>Reopen Case</button>
            )}
            <button className="danger" onClick={onDeleteCase}>Delete</button>
          </div>
        </div>
      </header>

      {shareOpen ? (
        <section className="share-panel">
          <div className="thread-header">
            <h3>Case Access</h3>
            <span className="section-pill">{shareState.sharedUsers.length}</span>
          </div>
          <div className="share-owner">
            Owner: {shareState.owner?.email || "Not assigned yet"}
          </div>
          {canManageShare ? (
            <div className="share-form">
              <input
                type="email"
                placeholder="doctor@clinic.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <button
                type="button"
                className="ghost-dark"
                onClick={handleShareCase}
                disabled={shareSubmitting}
              >
                {shareSubmitting ? "Sharing..." : "Add Access"}
              </button>
            </div>
          ) : (
            <div className="case-empty">Only owner or admin can change access.</div>
          )}

          {shareLoading ? (
            <div className="case-empty">Loading access list...</div>
          ) : shareState.sharedUsers.length === 0 ? (
            <div className="case-empty">No shared users yet.</div>
          ) : (
            <ul className="thread-list">
              {shareState.sharedUsers.map((user) => (
                <li key={user._id} className="thread-item share-item">
                  <div>
                    <div className="thread-kind">{user.name || "Doctor"}</div>
                    <div className="thread-date">{user.email}</div>
                  </div>
                  {canManageShare ? (
                    <button
                      className="danger"
                      disabled={shareSubmitting}
                      onClick={() => handleUnshare(user._id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="print-note print-only">
        <div className="print-header">
          <div>
            <h1>CaseLoom Visit Note</h1>
            <div className="print-sub">
              {item.title} • {item.patientAlias}
            </div>
          </div>
          <div className="print-meta">
            <div>Status: {item.status}</div>
            <div>Created: {formatDateTime(item.createdAt)}</div>
          </div>
        </div>

        <div className="print-block">
          <h2>Summary</h2>
          <p>{item.summary || "Not provided"}</p>
        </div>

        <div className="print-block">
          <h2>Timeline</h2>
          {timeline.length === 0 ? (
            <p>No timeline events recorded.</p>
          ) : (
            <ul>
              {timeline.map((event) => (
                <li key={event._id}>
                  <strong>{event.kind.toUpperCase()}</strong> — {formatDateTime(event.occurredAt)}
                  <div>{event.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="print-block">
          <h2>Decision Points</h2>
          {decisions.length === 0 ? (
            <p>No decision points recorded.</p>
          ) : (
            <ul>
              {decisions.map((decision) => (
                <li key={decision._id}>
                  <strong>{decision.decisionType}</strong>
                  <div>Rationale: {decision.rationale}</div>
                  <div>Next Step: {decision.nextStep}</div>
                  {decision.followUpBy ? (
                    <div>Follow-Up By: {formatDate(decision.followUpBy)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="print-block">
          <h2>Task Queue</h2>
          {tasks.length === 0 ? (
            <p>No tasks recorded.</p>
          ) : (
            <ul>
              {tasks.map((task) => (
                <li key={task._id}>
                  [{task.status}] {task.title}
                  {task.dueAt ? ` (Due ${formatDate(task.dueAt)})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="print-block">
          <h2>Appointments</h2>
          {appointments.length === 0 ? (
            <p>No appointments linked.</p>
          ) : (
            <ul>
              {appointments.map((appointment) => (
                <li key={appointment._id}>
                  <strong>{appointment.title}</strong> — {formatDateTime(appointment.scheduledFor)}
                  <div>Patient: {appointment.patientAlias || item.patientAlias}</div>
                  {appointment.contactPhone ? <div>SMS: {appointment.contactPhone}</div> : null}
                  <div>Status: {appointment.status}</div>
                  {appointment.notes ? <div>Notes: {appointment.notes}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="case-thread">
        <section className="thread-panel template-panel">
          <div className="thread-header">
            <h3>Visit Templates</h3>
            <span className="section-pill">SOAP</span>
          </div>
          <label className="form-field">
            Specialty Template
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {visitTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Template Notes
            <textarea
              rows={6}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button type="button" className="primary" onClick={handleInsertTemplate}>
              Add to Timeline
            </button>
          </div>
        </section>

        <section className="thread-panel attachment-panel">
          <div className="thread-header">
            <h3>Attachments</h3>
            <span className="section-pill">{attachments.length}</span>
          </div>
          <label className="form-field">
            Upload file (labs, scans, PDFs)
            <input type="file" onChange={handleAttachmentUpload} />
          </label>
          {attachments.length === 0 ? (
            <div className="case-empty">No attachments yet.</div>
          ) : (
            <ul className="thread-list attachment-list">
              {attachments.map((attachment) => (
                <li key={attachment._id} className="thread-item attachment-item">
                  <div className="thread-title">
                    <span className="thread-kind">{attachment.originalName}</span>
                    <span className="thread-date">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="attachment-actions">
                    <button
                      type="button"
                      className="ghost-dark icon-button"
                      onClick={() => handleViewAttachment(attachment._id)}
                      aria-label="View attachment securely"
                      title="View"
                    >
                      <span className="icon-eye" aria-hidden="true">View</span>
                    </button>
                    <button
                      className="danger"
                      onClick={() => handleDeleteAttachment(attachment._id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="thread-row">
          <section className="thread-panel">
            <div className="thread-header">
              <h3>Timeline</h3>
              <span className="section-pill">{timeline.length}</span>
            </div>
            <TimelineEventForm onAdd={onAddTimeline} />
            {timeline.length > 0 ? (
              <ul className="thread-list">
                {timeline.map((event) => (
                  <li key={event._id} className="thread-item">
                    <div className="thread-title">
                      <span className="thread-kind">{event.kind}</span>
                      <span className="thread-date">{new Date(event.occurredAt).toLocaleString()}</span>
                    </div>
                    <div className="thread-body">{event.description}</div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="thread-panel">
            <div className="thread-header">
              <h3>Decision Points</h3>
              <span className="section-pill">{decisions.length}</span>
            </div>
            <DecisionPointForm
              onAdd={onAddDecisionPoint}
              prefillRationale={decisionPrefill?.rationale}
              prefillNextStep={decisionPrefill?.nextStep}
              prefillKey={decisionPrefill?.key}
            />
            {decisions.length > 0 ? (
              <ul className="thread-list">
                {decisions.map((decision) => (
                  <li key={decision._id} className="thread-item">
                    <div className="thread-title">
                      <span className="thread-kind">{decision.decisionType}</span>
                    </div>
                    <div className="thread-body">{decision.rationale}</div>
                    <div className="thread-next">Next: {decision.nextStep}</div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <section className="thread-panel">
          <div className="thread-header">
            <h3>Task Queue</h3>
            <span className="section-pill">{tasks.length}</span>
          </div>
          <TaskForm onAdd={onAddTask} />
          {tasks.length === 0 ? (
            <div className="case-empty">No tasks yet. Add follow-ups or reminders.</div>
          ) : (
            <ul className="thread-list task-list">
              {tasks.map((task) => (
                <li key={task._id} className={`thread-item task-item ${task.status === "done" ? "task-done" : ""}`}>
                  <div className="task-main">
                    <button
                      className="task-toggle"
                      onClick={() => onToggleTask(task._id, task.status === "done" ? "open" : "done")}
                    >
                      {task.status === "done" ? "✓" : "○"}
                    </button>
                    <div>
                      <div className="task-title">{task.title}</div>
                      {task.dueAt ? (
                        <div className="task-meta">Due {new Date(task.dueAt).toLocaleDateString()}</div>
                      ) : null}
                    </div>
                  </div>
                  <button className="ghost-dark" onClick={() => onDeleteTask(task._id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="thread-panel">
          <div className="thread-header">
            <h3>Case Appointments</h3>
            <span className="section-pill">{appointments.length}</span>
          </div>
          {appointments.length === 0 ? (
            <div className="case-empty">No appointments linked to this case yet.</div>
          ) : (
            <ul className="thread-list">
              {appointments.map((appointment) => (
                <li key={appointment._id} className="thread-item">
                  <div className="thread-title">
                    <span className="thread-kind">{appointment.title}</span>
                    <span className="thread-date">{new Date(appointment.scheduledFor).toLocaleString()}</span>
                  </div>
                  <div className="thread-body">{appointment.patientAlias || item.patientAlias}</div>
                  {appointment.contactPhone ? (
                    <div className="thread-next">SMS: {appointment.contactPhone}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

