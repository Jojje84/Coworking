// ─────────────────────────────────────────
// Seed Users From Mock
// ─────────────────────────────────────────

import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import bcrypt from "bcrypt";
import { logger } from "../utils/logger.js";

dotenv.config();

const MOCK_USERS = [
  {
    username: "Anna Andersson",
    email: "admin@cowork.se",
    role: "Admin",
    permissions: {
      bookingHardDelete: true,
      userHardDelete: true,
      manageAdmins: true,
      manageSettings: true,
      viewAuditLogs: true,
    },
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
    permissions: u.permissions || {
      bookingHardDelete: false,
      userHardDelete: false,
      manageAdmins: false,
      manageSettings: false,
      viewAuditLogs: false,
    },
    password: hash,
  }));

  const created = await User.insertMany(docs);

  logger.info("✅ Seeded users:");
  created.forEach((u) => logger.info(u._id.toString(), u.username, u.role));
  logger.info(`✅ Default password for seeded users: ${defaultPassword}`);

  process.exit(0);
}

seed().catch((e) => {
  logger.error("❌ Seed users error:", e);
  process.exit(1);
});
