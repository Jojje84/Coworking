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

export function validateStartupEnv() {
  getRequiredEnv("MONGO_URI");
  getJwtSecret();

  if (process.env.NODE_ENV === "production") {
    getRequiredEnv("CLIENT_ORIGIN");
  }
}
