import mongoose from "mongoose";

const DecisionPointSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
    decisionType: {
      type: String,
      enum: ["lab_followup", "referral", "med_adjust", "check_in", "other"],
      required: true
    },
    rationale: { type: String, required: true },
    nextStep: { type: String, required: true },
    followUpBy: { type: Date }
  },
  { timestamps: true }
);

DecisionPointSchema.index({ caseId: 1, createdAt: -1 });

export const DecisionPoint = mongoose.model("DecisionPoint", DecisionPointSchema);
