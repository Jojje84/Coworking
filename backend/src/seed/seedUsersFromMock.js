// ─────────────────────────────────────────
// Seed Users From Mock
// ─────────────────────────────────────────

import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import bcrypt from "bcrypt";

dotenv.config();

const MOCK_USERS = [
  {
    username: "Anna Andersson",
    email: "admin@cowork.se",
    role: "Admin",
    createdAt: "2024-01-01T10:00:00Z",
  },
  {
    username: "Erik Eriksson",
    email: "user@cowork.se",
    role: "User",
    createdAt: "2024-01-15T14:30:00Z",
  },
  {
    username: "Maria Svensson",
    email: "maria@cowork.se",
    role: "User",
    createdAt: "2024-02-01T09:00:00Z",
  },
];

async function seed() {
  await connectDB();

  // removes old test users (so you can safely rerun the seed)
  await User.deleteMany({
    username: { $in: MOCK_USERS.map((u) => u.username) },
  });

  const defaultPassword = process.env.SEED_PASSWORD || "Password123!";
  const hash = await bcrypt.hash(defaultPassword, 10);

  const docs = MOCK_USERS.map((u) => ({
    username: u.username,
    email: u.email,
    role: u.role,
    password: hash,
  }));

  const created = await User.insertMany(docs);

  console.log("✅ Seeded users:");
  created.forEach((u) => console.log(u._id.toString(), u.username, u.role));
  console.log(`✅ Default password for seeded users: ${defaultPassword}`);

  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed users error:", e);
  process.exit(1);
});
