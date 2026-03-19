import { AppError } from "../utils/appError.js";
import { isValidObjectId } from "../utils/validation.js";
import {
  syncCompletedBookings,
  sanitizeCalendarBooking,
  createBookingWithAudit,
  updateBookingWithAudit,
  cancelBookingWithAudit,
  hardDeleteBookingWithAudit,
  hasBookingConflict,
  purgeExpiredBookingsService,
} from "../services/bookingService.js";
import { Booking } from "../models/Booking.js";
import { logger } from "../utils/logger.js";

function getCurrentUserId(req) {
  return req.user?.id || req.user?._id || null;
}

function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
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
    logger.error("getBookings error:", err);
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
    logger.error("getCalendarBookings error:", err);
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

    const conflict = await hasBookingConflict({
      roomId,
      start,
      end,
      excludeBookingId,
    });

    return res.json({ available: !conflict });
  } catch (err) {
    logger.error("checkAvailability error:", err);
    next(err);
  }
}

// ─────────────────────────────────────────
// Create Booking
// ─────────────────────────────────────────

export async function createBooking(req, res, next) {
  try {
    await syncCompletedBookings();

    const userId = req.user?.id || req.user?._id;

    const booking = await createBookingWithAudit({
      req,
      userId,
      roomId: req.body.roomId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    });

    return res.status(201).json(booking);
  } catch (err) {
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
    const currentUserId = req.user?.id || req.user?._id;
    const isAdmin = (req.user?.role || "").toLowerCase() === "admin";

    const booking = await updateBookingWithAudit({
      req,
      bookingId: id,
      currentUserId,
      isAdmin,
      roomId: req.body.roomId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      status: req.body.status,
    });

    return res.json(booking);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Delete Booking (Cancel)
// ─────────────────────────────────────────

export async function deleteBooking(req, res, next) {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || req.user?._id;
    const isAdmin = (req.user?.role || "").toLowerCase() === "admin";

    const booking = await cancelBookingWithAudit({
      req,
      bookingId: id,
      currentUserId,
      isAdmin,
    });

    return res.json(booking);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Hard Delete Booking (Admin)
// ─────────────────────────────────────────

export async function hardDeleteBooking(req, res, next) {
  try {
    const isAdmin = (req.user?.role || "").toLowerCase() === "admin";
    const confirmText = String(req.body?.confirmText || "").trim();

    const { id } = req.params;

    if (confirmText !== "DELETE") {
      return next(new AppError("Hard delete requires confirmText=DELETE", 400));
    }

    await hardDeleteBookingWithAudit({
      req,
      bookingId: id,
      isAdmin,
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Background Purge (Server Job)
// ─────────────────────────────────────────

export async function purgeExpiredBookings(now = new Date()) {
  return purgeExpiredBookingsService(now);
}
