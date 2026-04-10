import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, _next) {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const status = err.status || "error";
  const isProduction = process.env.NODE_ENV === "production";
  const message =
    statusCode >= 500 && isProduction
      ? "Internal server error"
      : err.message || "Something went wrong";
  const logDetails = {
    message: err.message,
    statusCode,
    path: req.originalUrl,
    method: req.method,
  };

  if (statusCode >= 500) {
    logger.error("Request failed", {
      ...logDetails,
      stack: err.stack,
    });
  } else {
    logger.warn("Request rejected", logDetails);
  }

  return res.status(statusCode).json({
    status,
    message,
  });
}
