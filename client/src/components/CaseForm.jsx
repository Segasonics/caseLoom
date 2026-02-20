import React, { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import TemplatePicker from "./TemplatePicker.jsx";

export default function CaseForm({ onCreate }) {
  const [patientAlias, setPatientAlias] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await Promise.resolve(onCreate({ patientAlias, title, summary, tags }));
      toast.success("Case created.");
      setPatientAlias("");
      setTitle("");
      setSummary("");
      setTagsInput("");
    } catch (err) {
      toast.error("Failed to create case.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleApplyTemplate(template) {
    setTitle(template.title);
    setSummary(template.summary);
  }

  function handleClearTemplate() {
    setTitle("");
    setSummary("");
  }

  return (
    <form className="case-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <h2>Start a New Case</h2>
          <p className="subtext">Capture a case thread quickly. You can refine the timeline later.</p>
        </div>
        <span className="pill">Draft</span>
      </div>

      <TemplatePicker onApply={handleApplyTemplate} onClear={handleClearTemplate} />

      <div className="form-grid">
        <label className="form-field">
          Patient Alias
          <input
            value={patientAlias}
            onChange={(e) => setPatientAlias(e.target.value.toUpperCase())}
            placeholder="e.g. JM-45F"
            required
          />
          <span className="hint">De-identified label only.</span>
        </label>

        <label className="form-field">
          Case Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Persistent cough + weight loss"
            required
          />
          <span className="hint">One line clinical focus.</span>
        </label>
      </div>

      <label className="form-field">
        Summary
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          placeholder="Brief context, key history, and why this case matters."
        />
      </label>

      <label className="form-field">
        Tags
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. cardio, urgent, follow-up"
        />
        <span className="hint">Comma-separated tags.</span>
      </label>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? (
            <span className="btn-inline">
              <Loader2 className="spin" size={16} />
              Adding...
            </span>
          ) : (
            "Create Case Thread"
          )}
        </button>
        <span className="subtext">You can add timeline events and decisions immediately after.</span>
      </div>
    </form>
  );
}
