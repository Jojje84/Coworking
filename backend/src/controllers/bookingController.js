import { Booking } from "../models/Booking.js";
import { Room } from "../models/Room.js";
import { AppError } from "../utils/AppError.js";
import { isValidObjectId } from "../utils/validation.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function toPlainBooking(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function getCurrentUserId(req) {
  return req.user?.id || req.user?._id || null;
}

function isAdminRole(role) {
  return role === "Admin" || role === "admin";
}

function getPayloadUserId(payload) {
  if (!payload?.userId) return null;

  if (typeof payload.userId === "object") {
    return (
      payload.userId._id?.toString?.() ||
      payload.userId.id?.toString?.() ||
      null
    );
  }

  return payload.userId.toString();
}

function emitBookingEvent(req, event, payload) {
  const io = req.app.get("io");
  if (!io || !payload) return;

  const plain = toPlainBooking(payload);
  const ownerId = getPayloadUserId(plain);

  if (ownerId) {
    io.to(ownerId).emit(event, plain);
  }

  io.to("admins").emit(event, plain);
}

function emitCalendarChanged(req) {
  const io = req.app.get("io");
  if (!io) return;

  io.emit("calendar:changed", {
    updatedAt: new Date().toISOString(),
  });
}

async function syncCompletedBookings() {
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

function resolveBookingStatus({ status, endTime }) {
  if (status === "cancelled") return "cancelled";
  return new Date(endTime) < new Date() ? "completed" : "active";
}

async function findPopulatedBooking(id, includeUser = true) {
  let query = Booking.findById(id).populate("roomId", "name capacity type");

  if (includeUser) {
    query = query.populate("userId", "username email role");
  }

  return query;
}

function sanitizeCalendarBooking(booking, currentUserId) {
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

// ─────────────────────────────────────────
// Get Bookings
// ─────────────────────────────────────────

export async function getBookings(req, res, next) {
  try {
    await syncCompletedBookings();

    const currentUserId = getCurrentUserId(req);
    const isAdmin = isAdminRole(req.user?.role);

    if (!currentUserId && !isAdmin) {
      return next(new AppError("Unauthorized", 401));
    }

    const filter = isAdmin ? {} : { userId: currentUserId };

    let query = Booking.find(filter)
      .sort({ startTime: -1, createdAt: -1 })
      .populate("roomId", "name capacity type");

    if (isAdmin) {
      query = query.populate("userId", "username email role");
    }

    const bookings = await query;

    return res.json(bookings);
  } catch (err) {
    console.error("getBookings error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Get Calendar Bookings
// ─────────────────────────────────────────

export async function getCalendarBookings(req, res, next) {
  try {
    await syncCompletedBookings();

    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { start, end } = req.query;

    if (!start || !end) {
      return next(new AppError("start and end are required", 400));
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      return next(new AppError("Invalid date range", 400));
    }

    const bookings = await Booking.find({
      status: { $ne: "cancelled" },
      startTime: { $lt: endDate },
      endTime: { $gt: startDate },
    })
      .sort({ startTime: 1, createdAt: 1 })
      .populate("roomId", "name");

    const sanitized = bookings.map((booking) =>
      sanitizeCalendarBooking(booking, currentUserId),
    );

    return res.json(sanitized);
  } catch (err) {
    console.error("getCalendarBookings error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Check Availability
// ─────────────────────────────────────────

export async function checkAvailability(req, res, next) {
  try {
    await syncCompletedBookings();

    const { roomId, startTime, endTime, excludeBookingId } = req.query;

    if (!roomId || !startTime || !endTime) {
      return next(new AppError("roomId, startTime, endTime required", 400));
    }

    if (!isValidObjectId(roomId)) {
      return next(new AppError("Invalid roomId", 400));
    }

    if (excludeBookingId && !isValidObjectId(excludeBookingId)) {
      return next(new AppError("Invalid excludeBookingId", 400));
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      return next(new AppError("Invalid time range", 400));
    }

    const filter = {
      roomId,
      status: { $ne: "cancelled" },
      startTime: { $lt: end },
      endTime: { $gt: start },
    };

    if (excludeBookingId) {
      filter._id = { $ne: excludeBookingId };
    }

    const conflict = await Booking.findOne(filter);

    return res.json({ available: !conflict });
  } catch (err) {
    console.error("checkAvailability error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Create Booking
// ─────────────────────────────────────────

export async function createBooking(req, res, next) {
  try {
    await syncCompletedBookings();

    const { roomId, startTime, endTime } = req.body;
    const userId = getCurrentUserId(req);

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!roomId || !startTime || !endTime) {
      return next(
        new AppError("roomId, startTime and endTime are required", 400),
      );
    }

    if (!isValidObjectId(roomId)) {
      return next(new AppError("Invalid roomId", 400));
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return next(new AppError("Room not found", 404));
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return next(new AppError("Invalid date format", 400));
    }

    if (start >= end) {
      return next(new AppError("startTime must be before endTime", 400));
    }

    const conflict = await Booking.findOne({
      roomId,
      status: { $ne: "cancelled" },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (conflict) {
      return next(new AppError("Room is already booked", 409));
    }

    const booking = await Booking.create({
      userId,
      roomId,
      startTime: start,
      endTime: end,
      status: resolveBookingStatus({ status: "active", endTime: end }),
    });

    const populated = await findPopulatedBooking(booking._id, true);
    if (!populated) {
      return next(new AppError("Booking created but could not be loaded", 500));
    }

    try {
      emitBookingEvent(req, "booking:created", populated);
      emitCalendarChanged(req);
    } catch (socketErr) {
      console.error("booking:created emit error:", socketErr);
    }

    return res.status(201).json(populated);
  } catch (err) {
    console.error("createBooking error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Update Booking
// ─────────────────────────────────────────

export async function updateBooking(req, res, next) {
  try {
    await syncCompletedBookings();

    const { id } = req.params;
    const currentUserId = getCurrentUserId(req);
    const isAdmin = isAdminRole(req.user?.role);

    if (!isValidObjectId(id)) {
      return next(new AppError("Invalid booking id", 400));
    }

    if (!currentUserId && !isAdmin) {
      return next(new AppError("Unauthorized", 401));
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }

    const isOwner = currentUserId
      ? booking.userId.toString() === currentUserId.toString()
      : false;

    if (!isOwner && !isAdmin) {
      return next(new AppError("Not allowed", 403));
    }

    const { roomId, startTime, endTime, status } = req.body;

    if (roomId !== undefined) {
      if (!isValidObjectId(roomId)) {
        return next(new AppError("Invalid roomId", 400));
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new AppError("Room not found", 404));
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
        return next(new AppError("Invalid status", 400));
      }
      booking.status = status;
    }

    if (
      Number.isNaN(booking.startTime.getTime()) ||
      Number.isNaN(booking.endTime.getTime())
    ) {
      return next(new AppError("Invalid date format", 400));
    }

    if (booking.startTime >= booking.endTime) {
      return next(new AppError("startTime must be before endTime", 400));
    }

    const conflict = await Booking.findOne({
      _id: { $ne: booking._id },
      roomId: booking.roomId,
      status: { $ne: "cancelled" },
      startTime: { $lt: booking.endTime },
      endTime: { $gt: booking.startTime },
    });

    if (conflict) {
      return next(new AppError("Room is already booked", 409));
    }

    if (booking.status !== "cancelled") {
      booking.status = resolveBookingStatus({
        status: booking.status,
        endTime: booking.endTime,
      });
    }

    await booking.save();

    const populated = await findPopulatedBooking(booking._id, true);
    if (!populated) {
      return next(new AppError("Updated booking could not be loaded", 500));
    }

    try {
      emitBookingEvent(req, "booking:updated", populated);
      emitCalendarChanged(req);
    } catch (socketErr) {
      console.error("booking:updated emit error:", socketErr);
    }

    return res.json(populated);
  } catch (err) {
    console.error("updateBooking error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Delete Booking
// ─────────────────────────────────────────

export async function deleteBooking(req, res, next) {
  try {
    const { id } = req.params;
    const currentUserId = getCurrentUserId(req);
    const isAdmin = isAdminRole(req.user?.role);

    if (!isValidObjectId(id)) {
      return next(new AppError("Invalid booking id", 400));
    }

    if (!currentUserId && !isAdmin) {
      return next(new AppError("Unauthorized", 401));
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return next(new AppError("Booking not found", 404));
    }

    const isOwner = currentUserId
      ? booking.userId.toString() === currentUserId.toString()
      : false;

    if (!isOwner && !isAdmin) {
      return next(new AppError("Not allowed", 403));
    }

    const deletedPayload = {
      id: booking._id.toString(),
      userId: booking.userId.toString(),
      roomId: booking.roomId.toString(),
    };

    await Booking.findByIdAndDelete(id);

    try {
      emitBookingEvent(req, "booking:deleted", deletedPayload);
      emitCalendarChanged(req);
    } catch (socketErr) {
      console.error("booking:deleted emit error:", socketErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteBooking error:", err);
    next(err);
  }
}
