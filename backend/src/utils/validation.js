import mongoose from "mongoose";

// ─────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidObjectId(id) {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
}
