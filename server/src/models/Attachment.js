import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { timestamps: true }
);

AttachmentSchema.index({ caseId: 1, createdAt: -1 });

export const Attachment = mongoose.model("Attachment", AttachmentSchema);
