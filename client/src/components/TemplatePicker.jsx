import React from "react";
import { caseTemplates } from "../data/caseTemplates.js";

export default function TemplatePicker({ onApply, onClear }) {
  return (
    <section className="template-picker">
      <div className="template-header">
        <div>
          <h3>Smart Templates</h3>
          <p className="subtext">Pick a template to prefill title and summary.</p>
        </div>
        <button type="button" className="ghost" onClick={onClear}>
          Clear Template
        </button>
      </div>
      <div className="template-grid">
        {caseTemplates.map((template) => (
          <button
            type="button"
            key={template.id}
            className="template-card"
            onClick={() => onApply(template)}
          >
            <span className="template-name">{template.name}</span>
            <span className="template-hint">{template.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
