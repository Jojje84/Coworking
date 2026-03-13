import { Room } from "../models/Room.js";
import { getRedis } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";
import { isNonEmptyString, isValidObjectId } from "../utils/validation.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function emitRoomEvent(req, event, payload) {
  const io = req.app.get("io");
  if (!io || !payload) return;
  io.emit(event, payload);
}

// ─────────────────────────────────────────
// Get All Rooms
// ─────────────────────────────────────────

export async function getRooms(req, res, next) {
  try {
    const redis = getRedis();

    if (redis) {
      const cached = await redis.get("rooms:all");
      if (cached) {
        console.log("✅ ROOMS CACHE HIT (from Redis)");
        return res.json(JSON.parse(cached));
      }
    }

    console.log("📦 ROOMS DB HIT (from MongoDB)");
    const rooms = await Room.find().sort({ createdAt: -1 });

    if (redis) {
      await redis.setex("rooms:all", 60, JSON.stringify(rooms));
    }

    return res.json(rooms);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Create Room
// ─────────────────────────────────────────

export async function createRoom(req, res, next) {
  try {
    let { name, capacity, type, description, imageUrl } = req.body;

    if (!isNonEmptyString(name)) {
      return next(new AppError("Room name is required", 400));
    }

    name = name.trim();
    capacity = Number(capacity);

    if (!Number.isInteger(capacity) || capacity < 1) {
      return next(
        new AppError("Capacity must be an integer greater than 0", 400),
      );
    }

    if (!["workspace", "conference"].includes(type)) {
      return next(new AppError("Type must be workspace or conference", 400));
    }

    const room = await Room.create({
      name,
      capacity,
      type,
      description: typeof description === "string" ? description.trim() : "",
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
    });

    const redis = getRedis();
    if (redis) {
      await redis.del("rooms:all");
    }

    try {
      emitRoomEvent(req, "room:created", room);
    } catch (socketErr) {
      console.error("room:created emit error:", socketErr);
    }

    return res.status(201).json(room);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Update Room
// ─────────────────────────────────────────

export async function updateRoom(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new AppError("Invalid room id", 400));
    }

    const { name, capacity, type, description, imageUrl } = req.body;
    const patch = {};

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return next(new AppError("Room name cannot be empty", 400));
      }
      patch.name = name.trim();
    }

    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
        return next(
          new AppError("Capacity must be an integer greater than 0", 400),
        );
      }
      patch.capacity = parsedCapacity;
    }

    if (type !== undefined) {
      if (!["workspace", "conference"].includes(type)) {
        return next(new AppError("Type must be workspace or conference", 400));
      }
      patch.type = type;
    }

    if (description !== undefined) {
      patch.description =
        typeof description === "string" ? description.trim() : "";
    }

    if (imageUrl !== undefined) {
      patch.imageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
    }

    const room = await Room.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      return next(new AppError("Room not found", 404));
    }

    const redis = getRedis();
    if (redis) {
      await redis.del("rooms:all");
    }

    try {
      emitRoomEvent(req, "room:updated", room);
    } catch (socketErr) {
      console.error("room:updated emit error:", socketErr);
    }

    return res.json(room);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Delete Room
// ─────────────────────────────────────────

export async function deleteRoom(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(new AppError("Invalid room id", 400));
    }

    const room = await Room.findByIdAndDelete(id);

    if (!room) {
      return next(new AppError("Room not found", 404));
    }

    const redis = getRedis();
    if (redis) {
      await redis.del("rooms:all");
    }

    try {
      emitRoomEvent(req, "room:deleted", { id: room._id.toString() });
    } catch (socketErr) {
      console.error("room:deleted emit error:", socketErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
