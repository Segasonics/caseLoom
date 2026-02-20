import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function CancelModal({ open, appointment, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setReason("");
  }, [appointment]);

  if (!open || !appointment) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error("Please add a reason.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    Promise.resolve(onConfirm(reason.trim()))
      .then(() => toast.success("Appointment cancelled."))
      .catch(() => toast.error("Failed to cancel."))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Cancel Appointment</h3>
        <p className="subtext">Provide a short reason for cancellation.</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            Reason
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient no longer available"
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-dark" onClick={onCancel}>
              Back
            </button>
            <button type="submit" className="danger" disabled={submitting}>
              {submitting ? (
                <span className="btn-inline">
                  <Loader2 className="spin" size={16} />
                  Cancelling...
                </span>
              ) : (
                "Cancel appointment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
