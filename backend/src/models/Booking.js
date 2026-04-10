// ─────────────────────────────────────────
// Booking Model
// ─────────────────────────────────────────

import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
    },
    cancelledAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

bookingSchema.pre("validate", function () {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    throw new Error("startTime must be before endTime");
  }
});

// Helps conflict checks like:
// roomId + active/cancelled status + time range lookups
bookingSchema.index({
  roomId: 1,
  status: 1,
  startTime: 1,
  endTime: 1,
});

export const Booking = mongoose.model("Booking", bookingSchema);
