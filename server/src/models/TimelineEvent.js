import mongoose from "mongoose";

const TimelineEventSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    kind: { type: String, enum: ["symptom", "exam", "test", "intervention", "note"], required: true },
    description: { type: String, required: true },
    occurredAt: { type: Date, required: true }
  },
  { timestamps: true }
);

TimelineEventSchema.index({ caseId: 1, occurredAt: -1 });

export const TimelineEvent = mongoose.model("TimelineEvent", TimelineEventSchema);
