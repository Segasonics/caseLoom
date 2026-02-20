import mongoose from "mongoose";

const CaseSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    patientAlias: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    aiSummary: { type: String, default: "" },
    aiSummaryUpdatedAt: { type: Date },
    aiSummaryModel: { type: String, default: "" }
  },
  { timestamps: true }
);

CaseSchema.index({ createdAt: -1 });
CaseSchema.index({ status: 1, createdAt: -1 });
CaseSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
CaseSchema.index({ sharedWith: 1, createdAt: -1 });

export const Case = mongoose.model("Case", CaseSchema);
