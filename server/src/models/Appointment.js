import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
    patientAlias: { type: String },
    contactPhone: { type: String, default: "" },
    title: { type: String, required: true },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: ["scheduled", "completed", "cancelled", "no_show"], default: "scheduled" },
    notes: { type: String, default: "" },
    statusHistory: {
      type: [
        {
          state: { type: String, required: true },
          reason: { type: String, default: "" },
          at: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

AppointmentSchema.index({ caseId: 1, scheduledFor: 1 });
AppointmentSchema.index({ scheduledFor: 1 });
AppointmentSchema.index({ createdBy: 1, scheduledFor: 1 });

export const Appointment = mongoose.model("Appointment", AppointmentSchema);
