// ─────────────────────────────────────────
// Seed Bookings From Mock
// ─────────────────────────────────────────

import dotenv from "dotenv";
import mongoose from "mongoose"; // ✅ lägg till denna
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { Room } from "../models/Room.js";

dotenv.config();
console.log("REGISTERED MODELS (before connect):", mongoose.modelNames());

const MOCK_BOOKINGS = [
  {
    userEmail: "user@cowork.se",
    roomName: "Focus Room 1",
    startTime: "2026-03-04T09:00:00.000Z",
    endTime: "2026-03-04T12:00:00.000Z",
  },
  {
    userEmail: "user@cowork.se",
    roomName: "Creative Room",
    startTime: "2026-03-04T14:00:00.000Z",
    endTime: "2026-03-04T16:00:00.000Z",
  },
  {
    userEmail: "maria@cowork.se",
    roomName: "Focus Room 2",
    startTime: "2026-03-05T10:00:00.000Z",
    endTime: "2026-03-05T15:00:00.000Z",
  },
];

async function seed() {
  await connectDB();
  console.log("REGISTERED MODELS (after connect):", mongoose.modelNames());

  // Optional: clear all old bookings so you can easily rerun the seed
  await Booking.deleteMany({});

  const created = [];

  for (const b of MOCK_BOOKINGS) {
    const user = await User.findOne({ email: b.userEmail });
    if (!user) throw new Error(`User not found: ${b.userEmail}`);

    const room = await Room.findOne({ name: b.roomName });
    if (!room) throw new Error(`Room not found: ${b.roomName}`);

    // conflict-check (samma logik som i API)
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);

    const conflict = await Booking.findOne({
      roomId: room._id,
      status: { $ne: "cancelled" },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (conflict) {
      console.log(
        `⚠️ Skipped (conflict): ${b.roomName} ${b.startTime} - ${b.endTime}`,
      );
      continue;
    }

    const booking = await Booking.create({
      userId: user._id,
      roomId: room._id,
      startTime: start,
      endTime: end,
      status: "active",
    });

    created.push(booking);
    console.log(
      `✅ Created booking: ${user.email} -> ${room.name} (${b.startTime} - ${b.endTime})`,
    );
  }

  console.log(`\n✅ Done. Created ${created.length} bookings.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed bookings error:", e);
  process.exit(1);
});
