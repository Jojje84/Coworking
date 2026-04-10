const isProduction = import.meta.env.PROD;

function write(method: "error" | "warn" | "info" | "debug", args: unknown[]) {
  if (method === "debug" && isProduction) return;
  const fn = console[method] as (...data: unknown[]) => void;
  fn(...args);
}

export const logger = {
  error: (...args: unknown[]) => write("error", args),
  warn: (...args: unknown[]) => write("warn", args),
  info: (...args: unknown[]) => write("info", args),
  debug: (...args: unknown[]) => write("debug", args),
};
