// ─────────────────────────────────────────
// Seed Rooms
// ─────────────────────────────────────────

import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { Room } from "../models/Room.js";
import { logger } from "../utils/logger.js";

dotenv.config();

const rooms = [
  {
    name: "Focus Room 1",
    capacity: 1,
    type: "workspace",
    description: "Quiet workspace perfect for focused work",
    imageUrl:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
  },
  {
    name: "Focus Room 2",
    capacity: 1,
    type: "workspace",
    description: "Ergonomic workspace with dual monitors",
    imageUrl:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop",
  },
  {
    name: "Creative Room",
    capacity: 4,
    type: "conference",
    description: "Conference room with whiteboard and projector",
    imageUrl:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop",
  },
  {
    name: "Large Meeting Room",
    capacity: 8,
    type: "conference",
    description: "Spacious conference room for larger meetings",
    imageUrl:
      "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800&h=600&fit=crop",
  },
  {
    name: "Innovation Hub",
    capacity: 12,
    type: "conference",
    description: "Modern conference room with video conferencing equipment",
    imageUrl:
      "https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=800&h=600&fit=crop",
  },
];

async function seed() {
  await connectDB();
  await Room.deleteMany({});
  const created = await Room.insertMany(rooms);
  logger.info("✅ Seeded rooms:");
  created.forEach((r) => logger.info(r._id.toString(), r.name));
  process.exit(0);
}

seed().catch((e) => {
  logger.error(e);
  process.exit(1);
});
