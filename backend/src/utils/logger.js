const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function normalizeLevel(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, key) ? key : null;
}

function resolveLogLevel() {
  const fromEnv = normalizeLevel(process.env.LOG_LEVEL);
  if (fromEnv) return fromEnv;

  const env = String(process.env.NODE_ENV || "development").toLowerCase();
  if (env === "test") return "warn";
  if (env === "production") return "info";
  return "debug";
}

const activeLevel = resolveLogLevel();

function canLog(level) {
  return LEVELS[level] <= LEVELS[activeLevel];
}

function write(method, level, args) {
  if (!canLog(level)) return;
  console[method](...args);
}

export const logger = {
  error: (...args) => write("error", "error", args),
  warn: (...args) => write("warn", "warn", args),
  info: (...args) => write("log", "info", args),
  debug: (...args) => write("log", "debug", args),
};
