import React, { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function TimelineEventForm({ onAdd }) {
  const [kind, setKind] = useState("symptom");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!occurredAt) {
      toast.error("Please choose a date/time.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onAdd({ kind, description, occurredAt }));
      toast.success("Timeline event added.");
      setDescription("");
      setOccurredAt("");
    } catch (err) {
      toast.error("Failed to add timeline event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <div className="inline-fields">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="symptom">Symptom</option>
          <option value="exam">Exam</option>
          <option value="test">Test</option>
          <option value="intervention">Intervention</option>
          <option value="note">Note</option>
        </select>
        <input
          placeholder="Describe the event"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} required />
      </div>
      <div className="inline-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? (
            <span className="btn-inline">
              <Loader2 className="spin" size={16} />
              Adding...
            </span>
          ) : (
            "Add"
          )}
        </button>
      </div>
    </form>
  );
}
