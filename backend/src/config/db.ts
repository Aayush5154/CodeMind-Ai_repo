import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected — driver will attempt to reconnect");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✓ MongoDB reconnected");
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true,
  });

  console.log("✓ MongoDB connected");
}
