import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

import roomRoutes from "./routes/roomRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import swaggerSpec from "./config/swagger.js";

// ─────────────────────────────────────────
// CORS
// ─────────────────────────────────────────

function getConfiguredOrigins() {
  return (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveCorsOrigin(origin, callback) {
  const configuredOrigins = getConfiguredOrigins();

  if (!origin) {
    return callback(null, true);
  }

  if (configuredOrigins.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return callback(new Error("CORS is not configured"));
    }

    return callback(null, true);
  }

  if (configuredOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Not allowed by CORS"));
}

// ─────────────────────────────────────────
// App Factory
// ─────────────────────────────────────────

export function createApp() {
  const app = express();

  // ─── Middleware ───

  app.use(
    cors({
      origin: resolveCorsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json());

  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // ─── Rate Limiting ───

  const authMaxRequests = process.env.NODE_ENV === "test" ? 1000 : 10;

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: authMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "fail",
      message: "Too many auth requests, please try again later.",
    },
  });

  // ─── Routes ───

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/rooms", roomRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/users", userRoutes);

  app.use((req, res) => {
    res.status(404).json({
      status: "fail",
      message: `Route not found: ${req.originalUrl}`,
    });
  });

  app.use(errorHandler);

  return app;
}
