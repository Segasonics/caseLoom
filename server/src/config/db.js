import mongoose from "mongoose";

export async function connectDb(uri) {
  if (!uri) {
    throw new Error("MONGO_URL is not set");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    autoIndex: true
  });
}
