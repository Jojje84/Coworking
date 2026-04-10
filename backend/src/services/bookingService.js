import { Booking } from "../models/Booking.js";
import { Room } from "../models/Room.js";
import { AppError } from "../utils/appError.js";
import { isValidObjectId } from "../utils/validation.js";
import { getUserDeleteGraceDays } from "../config/env.js";
import { safeRecordAuditLog } from "./auditLogService.js";
import {
  emitBookingEvent,
  emitCalendarChanged,
} from "./notificationService.js";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

export function toBookingAuditSnapshot(booking) {
  if (!booking) return null;

  const source =
    typeof booking.toObject === "function" ? booking.toObject() : booking;

  const id = source.id || source._id;
  const roomId = source.roomId?._id || source.roomId;
  const userId = source.userId?._id || source.userId;

  return {
    id: id ? id.toString() : null,
    userId: userId ? userId.toString() : null,
    roomId: roomId ? roomId.toString() : null,
    startTime: source.startTime
      ? new Date(source.startTime).toISOString()
      : null,
    endTime: source.endTime ? new Date(source.endTime).toISOString() : null,
    status: source.status || "active",
    cancelledAt: source.cancelledAt
      ? new Date(source.cancelledAt).toISOString()
      : null,
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

async function findPopulatedBooking(id, includeUser = true) {
  let query = Booking.findById(id).populate("roomId", "name capacity type");

  if (includeUser) {
    query = query.populate("userId", "username email role");
  }

  return query;
}

export function resolveBookingStatus({ status, endTime }) {
  if (status === "cancelled") return "cancelled";
  return new Date(endTime) < new Date() ? "completed" : "active";
}

export async function syncCompletedBookings() {
  await Booking.updateMany(
    {
      status: "active",
      endTime: { $lt: new Date() },
    },
    {
      $set: { status: "completed" },
    },
  );
}

export function buildOverlapFilter({
  roomId,
  start,
  end,
  excludeBookingId = null,
}) {
  const filter = {
    roomId,
    status: { $ne: "cancelled" },
    startTime: { $lt: end },
    endTime: { $gt: start },
  };

  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  return filter;
}

export async function hasBookingConflict({
  roomId,
  start,
  end,
  excludeBookingId = null,
}) {
  const conflict = await Booking.findOne(
    buildOverlapFilter({ roomId, start, end, excludeBookingId }),
  );

  return Boolean(conflict);
}

export async function createBookingForUser({ userId, roomId, start, end }) {
  return Booking.create({
    userId,
    roomId,
    startTime: start,
    endTime: end,
    status: resolveBookingStatus({ status: "active", endTime: end }),
    cancelledAt: null,
  });
}

export function sanitizeCalendarBooking(booking, currentUserId) {
  return {
    id: booking._id,
    roomId: booking.roomId?._id || null,
    roomName: booking.roomId?.name || "Unknown room",
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    isMine:
      !!currentUserId &&
      !!booking.userId &&
      booking.userId.toString() === currentUserId.toString(),
  };
}

function getRetentionCutoff(now = new Date()) {
  const graceDays = getUserDeleteGraceDays();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - graceDays);
  return cutoff;
}

export async function purgeExpiredBookingsService(now = new Date()) {
  const cutoff = getRetentionCutoff(now);

  const result = await Booking.deleteMany({
    $or: [
      {
        status: "cancelled",
        cancelledAt: { $ne: null, $lte: cutoff },
      },
      {
        status: "cancelled",
        cancelledAt: null,
        updatedAt: { $lte: cutoff },
      },
      {
        status: "completed",
        endTime: { $lte: cutoff },
      },
    ],
  });

  return { purgedBookings: result.deletedCount || 0 };
}

// ─────────────────────────────────────────
// Create Booking with Audit & Events
// ─────────────────────────────────────────

export async function createBookingWithAudit({
  req,
  userId,
  roomId,
  startTime,
  endTime,
}) {
  // Validate inputs
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  if (!roomId || !startTime || !endTime) {
    throw new AppError("roomId, startTime and endTime are required", 400);
  }

  if (!isValidObjectId(roomId)) {
    throw new AppError("Invalid roomId", 400);
  }

  const room = await Room.findById(roomId);
  if (!room) {
    throw new AppError("Room not found", 404);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError("Invalid date format", 400);
  }

  if (start >= end) {
    throw new AppError("startTime must be before endTime", 400);
  }

  const conflict = await hasBookingConflict({
    roomId,
    start,
    end,
  });

  if (conflict) {
    throw new AppError("Room is already booked", 409);
  }

  // Create booking
  const booking = await createBookingForUser({
    userId,
    roomId,
    start,
    end,
  });

  // Populate for response
  const populated = await findPopulatedBooking(booking._id, true);
  if (!populated) {
    throw new AppError("Booking created but could not be loaded", 500);
  }

  // Audit log
  await safeRecordAuditLog({
    req,
    action: "booking.created",
    targetType: "booking",
    targetId: populated._id,
    summary: `Booking created in ${room.name}`,
    metadata: {
      next: toBookingAuditSnapshot(populated),
    },
  });

  // Emit events
  try {
    emitBookingEvent(req, "booking:created", populated);
    emitCalendarChanged(req);
  } catch (socketErr) {
    logger.error("booking:created emit error:", socketErr);
  }

  return populated;
}

// ─────────────────────────────────────────
// Update Booking with Audit & Events
// ─────────────────────────────────────────

export async function updateBookingWithAudit({
  req,
  bookingId,
  currentUserId,
  isAdmin,
  roomId,
  startTime,
  endTime,
  status,
}) {
  if (!isValidObjectId(bookingId)) {
    throw new AppError("Invalid booking id", 400);
  }

  if (!currentUserId && !isAdmin) {
    throw new AppError("Unauthorized", 401);
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const isOwner = currentUserId
    ? booking.userId.toString() === currentUserId.toString()
    : false;

  if (!isOwner && !isAdmin) {
    throw new AppError("Not allowed", 403);
  }

  const previousSnapshot = toBookingAuditSnapshot(booking);

  // Validate and apply updates
  if (roomId !== undefined) {
    if (!isValidObjectId(roomId)) {
      throw new AppError("Invalid roomId", 400);
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new AppError("Room not found", 404);
    }

    booking.roomId = roomId;
  }

  if (startTime !== undefined) {
    booking.startTime = new Date(startTime);
  }

  if (endTime !== undefined) {
    booking.endTime = new Date(endTime);
  }

  if (status !== undefined) {
    if (!["active", "cancelled", "completed"].includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    if (status === "cancelled" && booking.status !== "cancelled") {
      booking.status = "cancelled";
      booking.cancelledAt = new Date();
    } else {
      booking.status = status;
    }
  }

  // Validate date range
  if (
    Number.isNaN(booking.startTime.getTime()) ||
    Number.isNaN(booking.endTime.getTime())
  ) {
    throw new AppError("Invalid date format", 400);
  }

  if (booking.startTime >= booking.endTime) {
    throw new AppError("startTime must be before endTime", 400);
  }

  // Check conflicts on room/time changes
  if (
    roomId !== undefined ||
    startTime !== undefined ||
    endTime !== undefined
  ) {
    const conflict = await hasBookingConflict({
      roomId: booking.roomId,
      start: booking.startTime,
      end: booking.endTime,
      excludeBookingId: bookingId,
    });

    if (conflict) {
      throw new AppError("Room is already booked for the selected time", 409);
    }
  }

  await booking.save();

  const populated = await findPopulatedBooking(bookingId, true);
  if (!populated) {
    throw new AppError("Booking updated but could not be loaded", 500);
  }

  const nextSnapshot = toBookingAuditSnapshot(populated);
  const changedFields = getChangedAuditFields(previousSnapshot, nextSnapshot);

  // Audit log
  if (changedFields.length > 0) {
    await safeRecordAuditLog({
      req,
      action: "booking.updated",
      targetType: "booking",
      targetId: populated._id,
      summary: `Booking updated`,
      metadata: {
        changedFields,
        previous: previousSnapshot,
        next: nextSnapshot,
      },
    });
  }

  // Emit events
  try {
    emitBookingEvent(req, "booking:updated", populated);
    emitCalendarChanged(req);
  } catch (socketErr) {
    logger.error("booking:updated emit error:", socketErr);
  }

  return populated;
}

// ─────────────────────────────────────────
// Cancel Booking with Audit & Events
// ─────────────────────────────────────────

export async function cancelBookingWithAudit({
  req,
  bookingId,
  currentUserId,
  isAdmin,
}) {
  if (!isValidObjectId(bookingId)) {
    throw new AppError("Invalid booking id", 400);
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const isOwner = currentUserId
    ? booking.userId.toString() === currentUserId.toString()
    : false;

  if (!isOwner && !isAdmin) {
    throw new AppError("Not allowed", 403);
  }

  if (booking.status === "cancelled") {
    throw new AppError("Booking is already cancelled", 400);
  }

  const previousSnapshot = toBookingAuditSnapshot(booking);

  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();

  const populated = await findPopulatedBooking(bookingId, true);
  if (!populated) {
    throw new AppError("Booking cancelled but could not be loaded", 500);
  }

  const nextSnapshot = toBookingAuditSnapshot(populated);

  // Audit log
  await safeRecordAuditLog({
    req,
    action: "booking.cancelled",
    targetType: "booking",
    targetId: populated._id,
    summary: `Booking cancelled`,
    metadata: {
      previous: previousSnapshot,
      next: nextSnapshot,
    },
  });

  // Emit events
  try {
    emitBookingEvent(req, "booking:updated", populated);
    emitCalendarChanged(req);
  } catch (socketErr) {
    logger.error("booking:cancelled emit error:", socketErr);
  }

  return populated;
}

// ─────────────────────────────────────────
// Hard Delete Booking with Audit & Events
// ─────────────────────────────────────────

export async function hardDeleteBookingWithAudit({ req, bookingId, isAdmin }) {
  if (!isAdmin) {
    throw new AppError("Permission required", 403);
  }

  if (!isValidObjectId(bookingId)) {
    throw new AppError("Invalid booking id", 400);
  }

  const booking = await Booking.findByIdAndDelete(bookingId);
  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  // Audit log
  await safeRecordAuditLog({
    req,
    action: "booking.hard_deleted",
    targetType: "booking",
    targetId: bookingId,
    summary: `Booking permanently deleted`,
    metadata: {
      previous: toBookingAuditSnapshot(booking),
    },
  });

  // Emit events
  try {
    emitBookingEvent(req, "booking:deleted", { id: booking._id.toString() });
    emitCalendarChanged(req);
  } catch (socketErr) {
    logger.error("booking:hard_deleted emit error:", socketErr);
  }

  return { id: booking._id.toString() };
}
