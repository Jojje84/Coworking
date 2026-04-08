import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Missing MONGO_URI in .env");

    await mongoose.connect(uri);
    logger.info("✅ MongoDB connected (Mongoose)");
  } catch (err) {
    logger.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}
