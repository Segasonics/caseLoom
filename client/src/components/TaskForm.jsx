import React, { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title) {
      toast.error("Please add a task title.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onAdd({ title, dueAt: dueAt || null }));
      toast.success("Task added.");
      setTitle("");
      setDueAt("");
    } catch (err) {
      toast.error("Failed to add task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <div className="inline-fields">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          className="date-field"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
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
