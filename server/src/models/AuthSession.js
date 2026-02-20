import mongoose from "mongoose";

const AuthSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    // Keep plain field here; TTL index is declared below with expireAfterSeconds.
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: "" },
    createdFromIp: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

AuthSessionSchema.index({ userId: 1, createdAt: -1 });
// TTL index auto-removes expired refresh sessions.
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = mongoose.model("AuthSession", AuthSessionSchema);
