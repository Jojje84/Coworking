import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { connectDB } from "./config/db.js";
import { createApp, resolveCorsOrigin } from "./app.js";
import {
  getJwtSecret,
  getUserPurgeIntervalMinutes,
  validateStartupEnv,
} from "./config/env.js";
import { User } from "./models/User.js";
import { purgeSoftDeletedUsers } from "./controllers/userController.js";
import { purgeExpiredBookings } from "./controllers/bookingController.js";

dotenv.config();

// ─────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────

const app = createApp();

const PORT = process.env.PORT || 5000;

async function start() {
  validateStartupEnv();
  await connectDB();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: resolveCorsOrigin,
      credentials: true,
    },
  });

  app.set("io", io);

  const purgeIntervalMinutes = getUserPurgeIntervalMinutes();
  const purgeIntervalMs = purgeIntervalMinutes * 60 * 1000;

  const purgeTimer = setInterval(async () => {
    try {
      const [userResult, bookingResult] = await Promise.all([
        purgeSoftDeletedUsers(),
        purgeExpiredBookings(),
      ]);

      if (userResult.purgedUsers > 0) {
        console.log(
          `🧹 Purged ${userResult.purgedUsers} expired soft-deleted users`,
        );
      }

      if (bookingResult.purgedBookings > 0) {
        console.log(
          `🧹 Purged ${bookingResult.purgedBookings} expired cancelled/completed bookings`,
        );
      }
    } catch (err) {
      console.error("soft-delete purge error:", err);
    }
  }, purgeIntervalMs);

  purgeTimer.unref();

  // ─────────────────────────────────────────
  // Socket.IO Authentication
  // ─────────────────────────────────────────

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Missing token"));
      }

      const payload = jwt.verify(token, getJwtSecret());
      const currentUser = await User.findById(payload.id).select(
        "role isDeleted",
      );

      if (!currentUser || currentUser.isDeleted) {
        return next(new Error("Authentication error"));
      }

      socket.user = {
        id: currentUser._id.toString(),
        role: currentUser.role,
      };

      return next();
    } catch (_err) {
      return next(new Error("Authentication error"));
    }
  });

  // ─────────────────────────────────────────
  // Socket.IO Connection Handler
  // ─────────────────────────────────────────

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

  // ─────────────────────────────────────────
  // Start Server
  // ─────────────────────────────────────────

  server.listen(PORT, () => {
    console.log("✅ API running on port " + PORT);
    console.log(`📘 Swagger docs: http://localhost:${PORT}/api/docs`);
    console.log(
      `🧹 Soft-delete purge job interval: ${purgeIntervalMinutes} minute(s)`,
    );
  });
}

start();
