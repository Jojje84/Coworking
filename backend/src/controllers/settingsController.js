import { AppError } from "../utils/appError.js";
import {
  getOrCreateAppSettings,
  toSettingsResponse,
} from "../services/settingsService.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";

export async function getSettings(req, res, next) {
  try {
    const settings = await getOrCreateAppSettings();
    return res.json(toSettingsResponse(settings));
  } catch (err) {
    return next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const settings = await getOrCreateAppSettings();

    const updates = {};

    if (req.body.allowSelfRegistration !== undefined) {
      if (typeof req.body.allowSelfRegistration !== "boolean") {
        return next(new AppError("allowSelfRegistration must be boolean", 400));
      }
      updates.allowSelfRegistration = req.body.allowSelfRegistration;
    }

    if (req.body.maintenanceMode !== undefined) {
      if (typeof req.body.maintenanceMode !== "boolean") {
        return next(new AppError("maintenanceMode must be boolean", 400));
      }
      updates.maintenanceMode = req.body.maintenanceMode;
    }

    if (req.body.adminAnnouncement !== undefined) {
      if (typeof req.body.adminAnnouncement !== "string") {
        return next(new AppError("adminAnnouncement must be string", 400));
      }

      const trimmed = req.body.adminAnnouncement.trim();
      if (trimmed.length > 500) {
        return next(new AppError("adminAnnouncement max length is 500", 400));
      }

      updates.adminAnnouncement = trimmed;
    }

    if (req.body.userAnnouncement !== undefined) {
      if (typeof req.body.userAnnouncement !== "string") {
        return next(new AppError("userAnnouncement must be string", 400));
      }

      const trimmed = req.body.userAnnouncement.trim();
      if (trimmed.length > 500) {
        return next(new AppError("userAnnouncement max length is 500", 400));
      }

      updates.userAnnouncement = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No valid settings fields provided", 400));
    }

    const previous = toSettingsResponse(settings);

    Object.assign(settings, updates, {
      updatedBy: req.user?.id || null,
    });

    await settings.save();

    const response = toSettingsResponse(settings);

    await safeRecordAuditLog({
      req,
      action: "settings.updated",
      targetType: "settings",
      targetId: settings._id,
      summary: "System settings were updated",
      metadata: {
        previous,
        next: response,
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("settings:updated", response);
    }

    return res.json(response);
  } catch (err) {
    return next(err);
  }
}
