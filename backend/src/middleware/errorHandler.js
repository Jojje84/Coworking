// ─────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────

export function errorHandler(err, req, res, next) {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const status = err.status || "error";
  const isProduction = process.env.NODE_ENV === "production";
  const message =
    statusCode >= 500 && isProduction
      ? "Internal server error"
      : err.message || "Something went wrong";

  console.error("❌ Error:", {
    message: err.message,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  return res.status(statusCode).json({
    status,
    message,
  });
}
