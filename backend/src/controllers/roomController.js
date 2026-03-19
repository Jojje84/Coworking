import { AppError } from "../utils/appError.js";
import { isValidObjectId } from "../utils/validation.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";
import { emitRoomEvent } from "../services/notificationService.js";
import {
  getRoomsService,
  createRoomService,
  updateRoomService,
  deleteRoomService,
  toRoomAuditSnapshot,
} from "../services/roomService.js";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Get All Rooms
// ─────────────────────────────────────────

export async function getRooms(req, res, next) {
  try {
    const rooms = await getRoomsService();
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
    const room = await createRoomService({
      name: req.body.name,
      capacity: req.body.capacity,
      type: req.body.type,
      description: req.body.description,
      imageUrl: req.body.imageUrl,
    });

    await safeRecordAuditLog({
      req,
      action: "room.created",
      targetType: "room",
      targetId: room._id,
      summary: `Room ${room.name} was created`,
      metadata: {
        next: toRoomAuditSnapshot(room),
      },
    });

    try {
      emitRoomEvent(req, "room:created", room);
    } catch (socketErr) {
      logger.error("room:created emit error:", socketErr);
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

    const { room, previousSnapshot, nextSnapshot, changedFields } =
      await updateRoomService({
        roomId: id,
        name: req.body.name,
        capacity: req.body.capacity,
        type: req.body.type,
        description: req.body.description,
        imageUrl: req.body.imageUrl,
      });

    if (changedFields.length > 0) {
      await safeRecordAuditLog({
        req,
        action: "room.updated",
        targetType: "room",
        targetId: room._id,
        summary: `Room ${room.name} was updated`,
        metadata: {
          changedFields,
          previous: previousSnapshot,
          next: nextSnapshot,
        },
      });
    }

    try {
      emitRoomEvent(req, "room:updated", room);
    } catch (socketErr) {
      logger.error("room:updated emit error:", socketErr);
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

    const { room, snapshot } = await deleteRoomService(id);

    await safeRecordAuditLog({
      req,
      action: "room.deleted",
      targetType: "room",
      targetId: room._id,
      summary: `Room ${room.name} was deleted`,
      metadata: {
        previous: snapshot,
      },
    });

    try {
      emitRoomEvent(req, "room:deleted", { id: room._id.toString() });
    } catch (socketErr) {
      logger.error("room:deleted emit error:", socketErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
