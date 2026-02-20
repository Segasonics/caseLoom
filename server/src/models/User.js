import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["doctor", "admin"], default: "doctor" }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
