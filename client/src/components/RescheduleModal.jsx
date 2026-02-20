import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function RescheduleModal({ open, appointment, onConfirm, onCancel }) {
  const [scheduledFor, setScheduledFor] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    const value = appointment.scheduledFor
      ? new Date(appointment.scheduledFor).toISOString().slice(0, 16)
      : "";
    setScheduledFor(value);
    setReason("");
  }, [appointment]);

  if (!open || !appointment) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!scheduledFor) {
      toast.error("Please choose a new date/time.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    Promise.resolve(onConfirm(scheduledFor, reason))
      .then(() => toast.success("Appointment rescheduled."))
      .catch(() => toast.error("Failed to reschedule."))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Reschedule Appointment</h3>
        <p className="subtext">
          Update the date/time for {appointment.title}.
        </p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            New Date & Time
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            Reason (optional)
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient requested different time"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-dark" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? (
                <span className="btn-inline">
                  <Loader2 className="spin" size={16} />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
