import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    title: { type: String, required: true },
    dueAt: { type: Date },
    status: { type: String, enum: ["open", "done"], default: "open" }
  },
  { timestamps: true }
);

TaskSchema.index({ caseId: 1, createdAt: -1 });

export const Task = mongoose.model("Task", TaskSchema);
