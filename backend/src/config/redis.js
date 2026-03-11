import Redis from "ioredis";

let redis = null;

export function getRedis() {
  if (redis) return redis;
  if (!process.env.REDIS_URL) return null;

  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  redis.on("error", (e) => console.error("❌ Redis error:", e.message));
  redis.on("connect", () => console.log("✅ Redis connected"));

  return redis;
}
