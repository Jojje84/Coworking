import { AuditLog } from "../models/AuditLog.js";
import { AppError } from "../utils/AppError.js";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function getAuditLogs(req, res, next) {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);

    const filter = {};

    if (req.query.action) {
      filter.action = String(req.query.action).trim();
    }

    if (req.query.targetType) {
      filter.targetType = String(req.query.targetType).trim();
    }

    if (req.query.actorId) {
      filter.actorId = String(req.query.actorId).trim();
    }

    if (req.query.actorRole) {
      const actorRole = String(req.query.actorRole).trim();
      if (actorRole) {
        filter.actorRole = new RegExp(`^${actorRole}$`, "i");
      }
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};

      if (req.query.from) {
        const fromDate = new Date(String(req.query.from));
        if (Number.isNaN(fromDate.getTime())) {
          return next(new AppError("Invalid from date", 400));
        }
        filter.createdAt.$gte = fromDate;
      }

      if (req.query.to) {
        const toDate = new Date(String(req.query.to));
        if (Number.isNaN(toDate.getTime())) {
          return next(new AppError("Invalid to date", 400));
        }
        filter.createdAt.$lte = toDate;
      }
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actorId", "username email role"),
    ]);

    const items = logs.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      summary: log.summary,
      metadata: log.metadata || {},
      actor: log.actorId
        ? {
            id: log.actorId._id?.toString?.() || log.actorId.toString(),
            username: log.actorId.username || "Unknown",
            email: log.actorId.email || "",
            role: log.actorId.role || log.actorRole || "unknown",
          }
        : {
            id: null,
            username: "Unknown",
            email: "",
            role: log.actorRole || "unknown",
          },
      actorRole: log.actorRole,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }));

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    });
  } catch (err) {
    return next(err);
  }
}
