import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { connectDB } from "./config/db.js";

import roomRoutes from "./routes/roomRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import swaggerSpec from "./config/swagger.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  }),
);

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Too many auth requests, please try again later.",
  },
});

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

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true,
    },
  });

  app.set("io", io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Missing token"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = {
        id: payload.id,
        role: payload.role,
      };

      return next();
    } catch (_err) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    try {
      const userId = socket.user?.id?.toString?.();
      const role = (socket.user?.role || "").toLowerCase();

      if (!userId) {
        socket.disconnect();
        return;
      }

      socket.join(userId);

      if (role === "admin") {
        socket.join("admins");
      }

      console.log(
        `✅ Socket connected: ${socket.id} user=${userId} role=${role}`,
      );
    } catch (err) {
      console.error("Socket connection setup error:", err);
      socket.disconnect();
    }

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, () => {
    console.log("✅ API running on port " + PORT);
    console.log(`📘 Swagger docs: http://localhost:${PORT}/api/docs`);
  });
}

start();
