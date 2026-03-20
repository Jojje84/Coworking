import { Room } from "../models/Room.js";
import { getRedis } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";
import { isNonEmptyString } from "../utils/validation.js";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

export function toRoomAuditSnapshot(room) {
  if (!room) return null;

  const source = typeof room.toObject === "function" ? room.toObject() : room;
  const id = source.id || source._id;

  return {
    id: id ? id.toString() : null,
    name: source.name || "",
    capacity: Number(source.capacity || 0),
    type: source.type || "workspace",
    description: source.description || "",
    imageUrl: source.imageUrl || "",
  };
}

export function getChangedAuditFields(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot || !nextSnapshot) return [];

  const fields = Array.from(
    new Set([...Object.keys(previousSnapshot), ...Object.keys(nextSnapshot)]),
  );

  return fields.filter(
    (field) =>
      JSON.stringify(previousSnapshot[field]) !==
      JSON.stringify(nextSnapshot[field]),
  );
}

async function invalidateRoomsCache() {
  const redis = getRedis();
  if (redis) {
    await redis.del("rooms:all");
  }
}

// ─────────────────────────────────────────
// Get Rooms
// ─────────────────────────────────────────

export async function getRoomsService() {
  const redis = getRedis();

  if (redis) {
    const cached = await redis.get("rooms:all");
    if (cached) {
      logger.debug("✅ ROOMS CACHE HIT (from Redis)");
      return JSON.parse(cached);
    }
  }

  logger.debug("📦 ROOMS DB HIT (from MongoDB)");
  const rooms = await Room.find().sort({ createdAt: -1 });

  if (redis) {
    await redis.setex("rooms:all", 60, JSON.stringify(rooms));
  }

  return rooms;
}

// ─────────────────────────────────────────
// Create Room
// ─────────────────────────────────────────

export async function createRoomService({
  name,
  capacity,
  type,
  description,
  imageUrl,
}) {
  if (!isNonEmptyString(name)) {
    throw new AppError("Room name is required", 400);
  }

  name = name.trim();
  capacity = Number(capacity);

  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new AppError("Capacity must be an integer greater than 0", 400);
  }

  if (!["workspace", "conference"].includes(type)) {
    throw new AppError("Type must be workspace or conference", 400);
  }

  const room = await Room.create({
    name,
    capacity,
    type,
    description: typeof description === "string" ? description.trim() : "",
    imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
  });

  await invalidateRoomsCache();

  return room;
}

// ─────────────────────────────────────────
// Update Room
// ─────────────────────────────────────────

export async function updateRoomService({
  roomId,
  name,
  capacity,
  type,
  description,
  imageUrl,
}) {
  const room = await Room.findById(roomId);

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  const patch = {};
  const previousSnapshot = toRoomAuditSnapshot(room);

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      throw new AppError("Room name cannot be empty", 400);
    }
    patch.name = name.trim();
  }

  if (capacity !== undefined) {
    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      throw new AppError("Capacity must be an integer greater than 0", 400);
    }
    patch.capacity = parsedCapacity;
  }

  if (type !== undefined) {
    if (!["workspace", "conference"].includes(type)) {
      throw new AppError("Type must be workspace or conference", 400);
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

  Object.assign(room, patch);
  await room.save();

  const nextSnapshot = toRoomAuditSnapshot(room);
  const changedFields = getChangedAuditFields(previousSnapshot, nextSnapshot);

  await invalidateRoomsCache();

  return {
    room,
    previousSnapshot,
    nextSnapshot,
    changedFields,
  };
}

// ─────────────────────────────────────────
// Delete Room
// ─────────────────────────────────────────

export async function deleteRoomService(roomId) {
  const room = await Room.findByIdAndDelete(roomId);

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  await invalidateRoomsCache();

  return {
    room,
    snapshot: toRoomAuditSnapshot(room),
  };
}
