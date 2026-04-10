import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { AppError } from "../utils/appError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import {
  canManagePermissions,
  parsePermissionPatch,
} from "../utils/permissions.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";
import { emitUserEvent } from "../services/notificationService.js";
import {
  createUserService,
  toUserResponse,
  toUserAuditSnapshot,
  updateUserService,
  softDeleteUserService,
  restoreUserService,
  hardDeleteUserService,
  purgeSoftDeletedUsersService,
} from "../services/userService.js";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────
// Get All Users (Admin)
// ─────────────────────────────────────────

export async function getUsers(req, res, next) {
  try {
    const includeDeleted = req.query.includeDeleted === "true";
    const filter = includeDeleted ? {} : { isDeleted: { $ne: true } };
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Create User (Admin)
// ─────────────────────────────────────────

export async function createUser(req, res, next) {
  try {
    const actor = await User.findById(req.user?.id).select("permissions");
    const { patch: requestedPermissionPatch, invalid } = parsePermissionPatch(
      req.body,
    );
    const wantsPermissionAssignment =
      Object.keys(requestedPermissionPatch).length > 0;

    if (invalid.length > 0) {
      return next(
        new AppError(
          `Invalid permission values: ${invalid.join(", ")}. Expected boolean`,
          400,
        ),
      );
    }

    if (wantsPermissionAssignment && !canManagePermissions(actor)) {
      return next(
        new AppError("Only superadmin can grant admin permissions", 403),
      );
    }

    const user = await createUserService({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || "User",
      bookingHardDelete: req.body.bookingHardDelete,
      permissions: requestedPermissionPatch,
    });

    const payload = toUserResponse(user);

    await safeRecordAuditLog({
      req,
      action: "user.created",
      targetType: "user",
      targetId: payload.id,
      summary: `User ${payload.username} was created`,
      metadata: {
        role: payload.role,
        permissions: payload.permissions,
      },
    });

    try {
      emitUserEvent(req, "user:created", payload);
    } catch (socketErr) {
      logger.error("user:created emit error:", socketErr);
    }

    return res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Update User (Admin)
// ─────────────────────────────────────────

export async function updateUser(req, res, next) {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError("Invalid user id", 400));
    }

    const actor = await User.findById(req.user?.id).select("permissions");
    const { patch: permissionPatch, invalid } = parsePermissionPatch(req.body);

    if (invalid.length > 0) {
      return next(
        new AppError(
          `Invalid permission values: ${invalid.join(", ")}. Expected boolean`,
          400,
        ),
      );
    }

    if (
      Object.keys(permissionPatch).length > 0 &&
      !canManagePermissions(actor)
    ) {
      return next(
        new AppError(
          "Only superadmin can grant or revoke admin permissions",
          403,
        ),
      );
    }

    const {
      user: updatedUser,
      previousSnapshot,
      changedFields,
    } = await updateUserService({
      userId,
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      permissionPatch,
    });

    const payload = toUserResponse(updatedUser);

    await safeRecordAuditLog({
      req,
      action: "user.updated",
      targetType: "user",
      targetId: payload.id,
      summary: `User ${payload.username} was updated`,
      metadata: {
        changedFields,
        previous: previousSnapshot,
        next: toUserAuditSnapshot(updatedUser),
      },
    });

    try {
      emitUserEvent(req, "user:updated", payload);
    } catch (socketErr) {
      logger.error("user:updated emit error:", socketErr);
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Delete User (Admin)
// ─────────────────────────────────────────

export async function deleteUser(req, res, next) {
  try {
    const userId = req.params.id;
    const currentUserId = req.user?.id?.toString();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError("Invalid user id", 400));
    }

    const deletedPayload = await softDeleteUserService({
      userId,
      currentUserId,
    });

    await safeRecordAuditLog({
      req,
      action: "user.soft_deleted",
      targetType: "user",
      targetId: userId,
      summary: `User ${deletedPayload.username} was soft deleted`,
      metadata: {
        deleteAfter: deletedPayload.deleteAfter,
      },
    });

    try {
      emitUserEvent(req, "user:deleted", {
        ...deletedPayload,
        soft: true,
      });
    } catch (socketErr) {
      logger.error("user:deleted emit error:", socketErr);
    }

    return res.json({
      message:
        "User soft deleted. Future active bookings were cancelled and can be reviewed during grace period.",
      deleteAfter: deletedPayload.deleteAfter,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Restore User (Admin)
// ─────────────────────────────────────────

export async function restoreUser(req, res, next) {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError("Invalid user id", 400));
    }

    const payload = await restoreUserService(userId);

    await safeRecordAuditLog({
      req,
      action: "user.restored",
      targetType: "user",
      targetId: payload.id,
      summary: `User ${payload.username} was restored`,
    });

    try {
      emitUserEvent(req, "user:restored", payload);
      emitUserEvent(req, "user:updated", payload);
    } catch (socketErr) {
      logger.error("user:restored emit error:", socketErr);
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Hard Delete User (Superadmin)
// ─────────────────────────────────────────

export async function hardDeleteUser(req, res, next) {
  try {
    const userId = req.params.id;
    const currentUserId = req.user?.id?.toString();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError("Invalid user id", 400));
    }

    const hardDeleteResult = await hardDeleteUserService({
      userId,
      currentUserId,
      confirmText: String(req.body?.confirmText || "").trim(),
    });

    await safeRecordAuditLog({
      req,
      action: "user.hard_deleted",
      targetType: "user",
      targetId: userId,
      summary: `User ${hardDeleteResult.username} was permanently deleted`,
    });

    try {
      emitUserEvent(req, "user:deleted", {
        id: hardDeleteResult.id,
        username: hardDeleteResult.username,
        role: hardDeleteResult.role,
      });
    } catch (socketErr) {
      logger.error("user:hard-deleted emit error:", socketErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

// ─────────────────────────────────────────
// Purge Soft Deleted Users (Job)
// ─────────────────────────────────────────

export async function purgeSoftDeletedUsers(now = new Date()) {
  return purgeSoftDeletedUsersService(now);
}

// ─────────────────────────────────────────
// Get Own Profile
// ─────────────────────────────────────────

export async function getMe(req, res, next) {
  try {
    const user = await User.findOne({
      _id: req.user.id,
      isDeleted: { $ne: true },
    }).select("-password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    return res.json(toUserResponse(user));
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Update Own Profile
// ─────────────────────────────────────────

export async function updateMe(req, res, next) {
  try {
    const user = await User.findOne({
      _id: req.user.id,
      isDeleted: { $ne: true },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    let { username, email, currentPassword, newPassword } = req.body;
    const updates = {};

    if (username !== undefined) {
      if (!isNonEmptyString(username)) {
        return next(new AppError("Username cannot be empty", 400));
      }

      username = username.trim();

      if (username.length < 3 || username.length > 30) {
        return next(
          new AppError("Username must be between 3 and 30 characters", 400),
        );
      }

      const existingUsername = await User.findOne({
        username,
        _id: { $ne: user._id },
      });

      if (existingUsername) {
        return next(new AppError("Username already exists", 409));
      }

      updates.username = username;
    }

    if (email !== undefined) {
      if (!isNonEmptyString(email)) {
        return next(new AppError("Email cannot be empty", 400));
      }

      email = email.trim().toLowerCase();

      if (!isValidEmail(email)) {
        return next(new AppError("Invalid email format", 400));
      }

      const existingEmail = await User.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return next(new AppError("Email already exists", 409));
      }

      updates.email = email;
    }

    const wantsToChangePassword =
      newPassword !== undefined && newPassword !== "";

    if (wantsToChangePassword) {
      if (!isNonEmptyString(currentPassword)) {
        return next(
          new AppError(
            "Current password is required to set a new password",
            400,
          ),
        );
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return next(new AppError("Current password is incorrect", 401));
      }

      if (!isNonEmptyString(newPassword)) {
        return next(new AppError("New password cannot be empty", 400));
      }

      newPassword = newPassword.trim();

      if (newPassword.length < 6 || newPassword.length > 100) {
        return next(
          new AppError("New password must be at least 6 characters", 400),
        );
      }

      updates.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(user._id, updates, {
      new: true,
      select: "-password",
    });

    const payload = toUserResponse(updatedUser);

    try {
      emitUserEvent(req, "user:updated", payload);
    } catch (socketErr) {
      logger.error("user:updated emit error:", socketErr);
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
}
