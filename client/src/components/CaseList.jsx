import React from "react";

function CaseList({ title, items, selectedId, onSelect, emptyMessage }) {
  return (
    <div className="case-list">
      {title ? <h3>{title}</h3> : null}
      {items.length === 0 ? (
        <div className="case-empty">{emptyMessage || "No cases yet. Create your first case to begin."}</div>
      ) : (
        items.map((item) => (
          <button
            key={item._id}
            className={item._id === selectedId ? "case-item active" : "case-item"}
            onClick={() => {
              onSelect(item._id);
            }}
          >
            <div className="case-item-title">{item.title}</div>
            <div className="case-item-meta">
              <span className="case-alias">{item.patientAlias}</span>
              <span className="case-status">{item.status}</span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

export default React.memo(CaseList);
