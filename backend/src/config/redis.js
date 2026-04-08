import Redis from "ioredis";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Redis Connection
// ─────────────────────────────────────────

let redis = null;

export function getRedis() {
  if (redis) return redis;
  if (!process.env.REDIS_URL) return null;

  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  redis.on("error", (e) => logger.error("❌ Redis error:", e.message));
  redis.on("connect", () => logger.info("✅ Redis connected"));

  return redis;
}
