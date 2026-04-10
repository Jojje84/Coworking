// ─────────────────────────────────────────
// Environment Variable Helpers
// ─────────────────────────────────────────

export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function getJwtSecret() {
  return getRequiredEnv("JWT_SECRET");
}

export function getUserDeleteGraceDays() {
  const raw = process.env.USER_DELETE_GRACE_DAYS;

  if (!raw || !raw.trim()) {
    return 14;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("USER_DELETE_GRACE_DAYS must be a non-negative number");
  }

  return Math.floor(parsed);
}

export function getUserPurgeIntervalMinutes() {
  const raw = process.env.USER_PURGE_INTERVAL_MINUTES;

  if (!raw || !raw.trim()) {
    return 60;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("USER_PURGE_INTERVAL_MINUTES must be a positive number");
  }

  return Math.floor(parsed);
}

export function validateStartupEnv() {
  getRequiredEnv("MONGO_URI");
  getJwtSecret();
  getUserDeleteGraceDays();
  getUserPurgeIntervalMinutes();

  if (process.env.NODE_ENV === "production") {
    getRequiredEnv("CLIENT_ORIGIN");
  }
}
