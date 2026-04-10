import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

dotenv.config();

function asObjectId(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return new mongoose.Types.ObjectId(str);
}

async function run() {
  await connectDB();

  const candidateLogs = await AuditLog.find({
    action: {
      $in: ["auth.login_succeeded", "auth.login_failed", "auth.register"],
    },
    $or: [{ actorId: null }, { actorRole: { $in: [null, "", "unknown"] } }],
  }).select("_id action targetId metadata actorId actorRole");

  if (candidateLogs.length === 0) {
    logger.info("No auth audit logs need backfill.");
    process.exit(0);
  }

  const updates = [];
  let resolvedFromUser = 0;
  let resolvedRoleOnly = 0;

  for (const log of candidateLogs) {
    const metadataUserId = asObjectId(log?.metadata?.userId);
    const targetUserId = asObjectId(log?.targetId);

    const userId = metadataUserId || targetUserId;
    const patch = {};

    if (userId) {
      const user = await User.findById(userId).select("role");
      if (user) {
        patch.actorId = user._id;
        patch.actorRole = user.role;
        resolvedFromUser += 1;
      }
    }

    if (Object.keys(patch).length === 0) {
      const roleFromMetadata =
        typeof log?.metadata?.role === "string" ? log.metadata.role.trim() : "";
      if (roleFromMetadata) {
        patch.actorRole = roleFromMetadata;
        resolvedRoleOnly += 1;
      }
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    updates.push({
      updateOne: {
        filter: { _id: log._id },
        update: { $set: patch },
      },
    });
  }

  if (updates.length === 0) {
    logger.info("No resolvable auth audit logs were found.");
    process.exit(0);
  }

  const result = await AuditLog.bulkWrite(updates, { ordered: false });

  logger.info("Backfill finished.");
  logger.info(`Matched: ${candidateLogs.length}`);
  logger.info(`Updated: ${result.modifiedCount || 0}`);
  logger.info(`Resolved with actorId+role: ${resolvedFromUser}`);
  logger.info(`Resolved with role only: ${resolvedRoleOnly}`);

  process.exit(0);
}

run().catch((err) => {
  logger.error("Backfill failed:", err);
  process.exit(1);
});
