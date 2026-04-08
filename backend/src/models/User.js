// ─────────────────────────────────────────
// User Model
// ─────────────────────────────────────────

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["User", "Admin"],
      default: "User",
    },
    permissions: {
      bookingHardDelete: {
        type: Boolean,
        default: false,
      },
      userHardDelete: {
        type: Boolean,
        default: false,
      },
      manageAdmins: {
        type: Boolean,
        default: false,
      },
      manageSettings: {
        type: Boolean,
        default: false,
      },
      viewAuditLogs: {
        type: Boolean,
        default: false,
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deleteAfter: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
