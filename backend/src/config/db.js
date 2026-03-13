import mongoose from "mongoose";

// ─────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Missing MONGO_URI in .env");

    await mongoose.connect(uri);
    console.log("✅ MongoDB connected (Mongoose)");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}
