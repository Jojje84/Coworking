import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { AppError } from "../utils/AppError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import { createUserService } from "../services/userService.js";
import { getUserDeleteGraceDays } from "../config/env.js";
import {
  buildPermissionsForRole,
  canManagePermissions,
  parsePermissionPatch,
  toPermissionResponse,
} from "../utils/permissions.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function normalizeRole(role) {
  return (role || "").toLowerCase() === "admin" ? "Admin" : "User";
}

function toUserResponse(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: toPermissionResponse(user.permissions),
    isDeleted: Boolean(user.isDeleted),
    deletedAt: user.deletedAt || null,
    deleteAfter: user.deleteAfter || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toUserAuditSnapshot(user) {
  if (!user) return null;

  const source =
    typeof user.toObject === "function" ? user.toObject() : user;

  const id = source.id || source._id;

  return {
    id: id ? id.toString() : null,
    username: source.username || "",
    email: source.email || "",
    role: source.role || "User",
    permissions: toPermissionResponse(source.permissions),
    isDeleted: Boolean(source.isDeleted),
  };
}

function getDeleteAfterDate(now = new Date()) {
  const graceDays = getUserDeleteGraceDays();
  const deleteAfter = new Date(now);
  deleteAfter.setDate(deleteAfter.getDate() + graceDays);
  return deleteAfter;
}

function isSuperadminUser(user) {
  if (!user) return false;

  const role = (user.role || "").toLowerCase();
  if (role !== "admin") return false;

  const permissions = toPermissionResponse(user.permissions);
  return Object.values(permissions).some(Boolean);
}

function isSuperadminState(role, permissions) {
  if ((role || "").toLowerCase() !== "admin") {
    return false;
  }

  const normalizedPermissions = toPermissionResponse(permissions);
  return Object.values(normalizedPermissions).some(Boolean);
}

function emitUserEvent(req, eventName, payload) {
  const io = req.app.get("io");
  if (!io) return;

  if (payload?.id) {
    io.to(payload.id).emit(eventName, payload);
  }

  io.to("admins").emit(eventName, payload);
}

async function countAdmins(excludeUserId = null) {
  const query = {
    role: "Admin",
    isDeleted: { $ne: true },
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return User.countDocuments(query);
}

async function countSuperadmins(excludeUserId = null) {
  const query = {
    role: "Admin",
    isDeleted: { $ne: true },
    $or: [
      { "permissions.bookingHardDelete": true },
      { "permissions.userHardDelete": true },
      { "permissions.manageAdmins": true },
      { "permissions.manageSettings": true },
      { "permissions.viewAuditLogs": true },
    ],
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return User.countDocuments(query);
}

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
    const { patch: requestedPermissionPatch, invalid } =
      parsePermissionPatch(req.body);
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
        new AppError(
          "Only superadmin can grant admin permissions",
          403,
        ),
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
      console.error("user:created emit error:", socketErr);
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

    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    let { username, email, password, role } = req.body;
    const updates = {};
    const actor = await User.findById(req.user?.id).select("permissions");
    const previousSnapshot = toUserAuditSnapshot(user);

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
        _id: { $ne: userId },
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
        _id: { $ne: userId },
      });

      if (existingEmail) {
        return next(new AppError("Email already exists", 409));
      }

      updates.email = email;
    }

    if (role !== undefined) {
      if (!isNonEmptyString(role)) {
        return next(new AppError("Role cannot be empty", 400));
      }

      const normalizedRole = normalizeRole(role.trim());

      if (!["User", "Admin"].includes(normalizedRole)) {
        return next(new AppError("Role must be User or Admin", 400));
      }

      const isDemotingAdmin =
        user.role === "Admin" && normalizedRole !== "Admin";

      if (isDemotingAdmin) {
        const otherAdmins = await countAdmins(user._id);

        if (otherAdmins === 0) {
          return next(new AppError("At least one admin must remain", 400));
        }
      }

      updates.role = normalizedRole;
    }

    const { patch: permissionPatch, invalid } = parsePermissionPatch(req.body);
    if (invalid.length > 0) {
      return next(
        new AppError(
          `Invalid permission values: ${invalid.join(", ")}. Expected boolean`,
          400,
        ),
      );
    }

    if (Object.keys(permissionPatch).length > 0) {
      if (!canManagePermissions(actor)) {
        return next(
          new AppError(
            "Only superadmin can grant or revoke admin permissions",
            403,
          ),
        );
      }

      updates.permissions = {
        ...toPermissionResponse(user.permissions),
        ...permissionPatch,
      };
    }

    const nextRole = updates.role ?? user.role;
    let nextPermissions =
      updates.permissions !== undefined
        ? updates.permissions
        : toPermissionResponse(user.permissions);

    if (nextRole !== "Admin") {
      nextPermissions = buildPermissionsForRole(nextRole, nextPermissions);
      updates.permissions = nextPermissions;
    }

    const isCurrentlySuperadmin = isSuperadminUser(user);
    const willRemainSuperadmin = isSuperadminState(nextRole, nextPermissions);

    if (isCurrentlySuperadmin && !willRemainSuperadmin) {
      const otherSuperadmins = await countSuperadmins(user._id);

      if (otherSuperadmins === 0) {
        return next(new AppError("At least one superadmin must remain", 400));
      }
    }

    if (password !== undefined && password !== "") {
      if (!isNonEmptyString(password)) {
        return next(new AppError("Password cannot be empty", 400));
      }

      password = password.trim();

      if (password.length < 6 || password.length > 100) {
        return next(
          new AppError("Password must be at least 6 characters", 400),
        );
      }

      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      select: "-password",
    });

    const payload = toUserResponse(updatedUser);

    const changedFields = Object.keys(updates).map((field) =>
      field === "password" ? "passwordChanged" : field,
    );

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
      console.error("user:updated emit error:", socketErr);
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

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.isDeleted) {
      return next(new AppError("User is already deleted", 400));
    }

    if (user._id.toString() === currentUserId) {
      return next(
        new AppError("You cannot delete your own admin account", 400),
      );
    }

    if (isSuperadminUser(user)) {
      return next(
        new AppError("Superadmin accounts cannot be deleted by admins", 403),
      );
    }

    if (user.role === "Admin") {
      const otherAdmins = await countAdmins(user._id);

      if (otherAdmins === 0) {
        return next(new AppError("At least one admin must remain", 400));
      }
    }

    const deletedPayload = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const now = new Date();
    const deleteAfter = getDeleteAfterDate(now);

    await Booking.updateMany(
      {
        userId,
        status: "active",
        startTime: { $gte: now },
      },
      {
        $set: { status: "cancelled", cancelledAt: now },
      },
    );

    await User.findByIdAndUpdate(userId, {
      $set: {
        isDeleted: true,
        deletedAt: now,
        deleteAfter,
      },
    });

    await safeRecordAuditLog({
      req,
      action: "user.soft_deleted",
      targetType: "user",
      targetId: userId,
      summary: `User ${user.username} was soft deleted`,
      metadata: {
        deleteAfter,
      },
    });

    try {
      emitUserEvent(req, "user:deleted", {
        ...deletedPayload,
        soft: true,
        deleteAfter,
      });
    } catch (socketErr) {
      console.error("user:deleted emit error:", socketErr);
    }

    return res.json({
      message:
        "User soft deleted. Future active bookings were cancelled and can be reviewed during grace period.",
      deleteAfter,
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

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.isDeleted) {
      return next(new AppError("User is not deleted", 400));
    }

    if (user.deleteAfter && user.deleteAfter < new Date()) {
      return next(
        new AppError("Grace period has expired. User can no longer be restored", 410),
      );
    }

    user.isDeleted = false;
    user.deletedAt = null;
    user.deleteAfter = null;
    await user.save();

    const payload = toUserResponse(user);

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
      console.error("user:restored emit error:", socketErr);
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
    const confirmText = String(req.body?.confirmText || "").trim();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new AppError("Invalid user id", 400));
    }

    if (confirmText !== "DELETE") {
      return next(new AppError("Hard delete requires confirmText=DELETE", 400));
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user._id.toString() === currentUserId) {
      return next(new AppError("You cannot hard delete your own admin account", 400));
    }

    if (isSuperadminUser(user)) {
      return next(
        new AppError("Superadmin accounts cannot be deleted by admins", 403),
      );
    }

    if (!user.isDeleted) {
      return next(
        new AppError(
          "User must be soft deleted before permanent removal",
          400,
        ),
      );
    }

    await Booking.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    await safeRecordAuditLog({
      req,
      action: "user.hard_deleted",
      targetType: "user",
      targetId: userId,
      summary: `User ${user.username} was permanently deleted`,
    });

    try {
      emitUserEvent(req, "user:deleted", {
        id: userId,
        username: user.username,
        role: user.role,
      });
    } catch (socketErr) {
      console.error("user:hard-deleted emit error:", socketErr);
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
  const filter = {
    isDeleted: true,
    deleteAfter: { $ne: null, $lte: now },
  };

  const usersToPurge = await User.find(filter).select("_id");
  if (usersToPurge.length === 0) {
    return { purgedUsers: 0 };
  }

  const userIds = usersToPurge.map((u) => u._id);

  await User.deleteMany({ _id: { $in: userIds } });

  return { purgedUsers: userIds.length };
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
      console.error("user:updated emit error:", socketErr);
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
}
