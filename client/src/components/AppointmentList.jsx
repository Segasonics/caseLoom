import React from "react";

function AppointmentList({
  title,
  items,
  onReschedule,
  onDelete,
  onCancel,
  onComplete,
  onNoShow
}) {
  return (
    <div className="appointment-list">
      <h3>{title}</h3>
      <div className="appointment-body">
        {items.length === 0 ? (
          <div className="case-empty full-height">No appointments scheduled.</div>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item._id}>
                <div className="appointment-title">{item.title}</div>
              <div className="appointment-meta">
                <span>{item.patientAlias || "Unassigned"}</span>
                <span>{new Date(item.scheduledFor).toLocaleString()}</span>
              </div>
              <div className={`appointment-status status-${item.status}`}>
                {item.status.replace("_", " ")}
              </div>
              {item.contactPhone ? (
                <div className="appointment-notes">SMS: {item.contactPhone}</div>
              ) : null}
              {item.notes ? <div className="appointment-notes">{item.notes}</div> : null}
              {item.statusHistory && item.statusHistory.length > 0 ? (
                <div className="appointment-timeline">
                  {item.statusHistory.slice(-3).map((entry, index) => (
                    <div key={`${entry.at}-${index}`} className="appointment-timeline-item">
                      <span className="timeline-state">{entry.state}</span>
                      <span className="timeline-date">
                        {new Date(entry.at).toLocaleDateString()}
                      </span>
                      {entry.reason ? (
                        <span className="timeline-reason">{entry.reason}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {onReschedule || onDelete || onCancel || onComplete || onNoShow ? (
                <div className="appointment-actions">
                  {onReschedule ? (
                    <button className="ghost-dark" onClick={() => onReschedule(item)}>
                      Reschedule
                    </button>
                  ) : null}
                  {onComplete ? (
                    <button
                      className="ghost-dark"
                      onClick={() => onComplete(item)}
                      disabled={item.status === "completed"}
                    >
                      Complete
                    </button>
                  ) : null}
                  {onNoShow ? (
                    <button
                      className="ghost-dark"
                      onClick={() => onNoShow(item)}
                      disabled={item.status === "no_show"}
                    >
                      No-show
                    </button>
                  ) : null}
                  {onCancel ? (
                    <button
                      className="ghost-dark"
                      onClick={() => onCancel(item)}
                      disabled={item.status === "cancelled"}
                    >
                      Cancel
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button className="danger" onClick={() => onDelete(item)}>
                      Delete
                    </button>
                  ) : null}
                </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default React.memo(AppointmentList);
