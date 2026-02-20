import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function DecisionPointForm({ onAdd, prefillRationale, prefillNextStep, prefillKey }) {
  const [decisionType, setDecisionType] = useState("lab_followup");
  const [rationale, setRationale] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpBy, setFollowUpBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!prefillKey) return;
    setRationale(prefillRationale || "");
    setNextStep(prefillNextStep || "");
  }, [prefillKey, prefillRationale, prefillNextStep]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(
        onAdd({ decisionType, rationale, nextStep, followUpBy: followUpBy || null })
      );
      toast.success("Decision point added.");
      setRationale("");
      setNextStep("");
      setFollowUpBy("");
    } catch (err) {
      toast.error("Failed to add decision point.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <div className="inline-fields">
        <select value={decisionType} onChange={(e) => setDecisionType(e.target.value)}>
          <option value="lab_followup">Lab Follow-up</option>
          <option value="referral">Referral</option>
          <option value="med_adjust">Medication Adjust</option>
          <option value="check_in">Check-in</option>
          <option value="other">Other</option>
        </select>
        <input
          placeholder="Rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          required
        />
        <input
          placeholder="Next step"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          required
        />
        <input
          className="date-field"
          type="date"
          value={followUpBy}
          onChange={(e) => setFollowUpBy(e.target.value)}
        />
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
