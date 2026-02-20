import React from "react";

export default function AIAssistPanel({
  hasCase,
  summary,
  summaryUpdatedAt,
  summaryLoading,
  summaryError,
  onGenerateSummary,
  decisionType,
  onDecisionTypeChange,
  draftLoading,
  draftError,
  draftRationale,
  draftNextStep,
  onDraft,
  onUseDraft
}) {
  return (
    <div className="ai-panel">
      <div className="ai-header">
        <div>
          <h3>AI Assist</h3>
          <p className="ai-note">De-identified data only.</p>
        </div>
      </div>

      <div className="ai-section">
        <div className="ai-section-header">
          <strong>Case Summary</strong>
          <button className="ghost-dark" onClick={onGenerateSummary} disabled={!hasCase || summaryLoading}>
            {summaryLoading ? "Generating..." : summary ? "Refresh" : "Generate Summary"}
          </button>
        </div>
        {summaryError ? <div className="form-error">{summaryError}</div> : null}
        {!hasCase ? (
          <div className="case-empty">Select a case to use AI Assist.</div>
        ) : summary ? (
          <div className="ai-output">
            <p>{summary}</p>
            {summaryUpdatedAt ? (
              <span className="ai-meta">Updated: {new Date(summaryUpdatedAt).toLocaleString()}</span>
            ) : null}
          </div>
        ) : (
          <div className="case-empty">No AI summary yet.</div>
        )}
      </div>

      <div className="ai-section">
        <div className="ai-section-header">
          <strong>Decision Draft</strong>
          <button className="ghost-dark" onClick={onDraft} disabled={!hasCase || draftLoading}>
            {draftLoading ? "Drafting..." : "Draft Rationale"}
          </button>
        </div>
        {draftError ? <div className="form-error">{draftError}</div> : null}
        <div className="ai-draft-controls">
          <label className="form-field">
            Decision Type
            <select value={decisionType} onChange={(e) => onDecisionTypeChange(e.target.value)}>
              <option value="lab_followup">Lab Follow-up</option>
              <option value="referral">Referral</option>
              <option value="med_adjust">Medication Adjust</option>
              <option value="check_in">Check-in</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        {!hasCase ? (
          <div className="case-empty">Select a case to generate a draft.</div>
        ) : draftRationale || draftNextStep ? (
          <div className="ai-output">
            {draftRationale ? <p><strong>Rationale:</strong> {draftRationale}</p> : null}
            {draftNextStep ? <p><strong>Next step:</strong> {draftNextStep}</p> : null}
            <div className="ai-actions">
              <button className="primary" onClick={onUseDraft}>Use in Decision Form</button>
            </div>
          </div>
        ) : (
          <div className="case-empty">Generate a draft to see suggestions.</div>
        )}
      </div>
    </div>
  );
}
