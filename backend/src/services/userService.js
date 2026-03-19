import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { AppError } from "../utils/appError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import {
  buildPermissionsForRole,
  toPermissionResponse,
} from "../utils/permissions.js";
import { getUserDeleteGraceDays } from "../config/env.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function normalizeRole(role) {
  return (role || "").toLowerCase() === "admin" ? "Admin" : "User";
}

export function toUserResponse(user) {
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

export function toUserAuditSnapshot(user) {
  if (!user) return null;

  const source = typeof user.toObject === "function" ? user.toObject() : user;
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

export function getDeleteAfterDate(now = new Date()) {
  const graceDays = getUserDeleteGraceDays();
  const deleteAfter = new Date(now);
  deleteAfter.setDate(deleteAfter.getDate() + graceDays);
  return deleteAfter;
}

export function isSuperadminUser(user) {
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

export async function countAdmins(excludeUserId = null) {
  const query = {
    role: "Admin",
    isDeleted: { $ne: true },
  };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return User.countDocuments(query);
}

export async function countSuperadmins(excludeUserId = null) {
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
// Create User
// ─────────────────────────────────────────

export async function createUserService({
  username,
  email,
  password,
  role = "User",
  bookingHardDelete = false,
  permissions,
}) {
  if (
    !isNonEmptyString(username) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(password)
  ) {
    throw new AppError("username, email and password are required", 400);
  }

  username = username.trim();
  email = email.trim().toLowerCase();
  password = password.trim();
  role = normalizeRole(role);

  if (username.length < 3 || username.length > 30) {
    throw new AppError("Username must be between 3 and 30 characters", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  if (password.length < 6 || password.length > 100) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hash = await bcrypt.hash(password, 10);

  const inputPermissions =
    permissions && typeof permissions === "object"
      ? permissions
      : { bookingHardDelete };

  const user = await User.create({
    username,
    email,
    password: hash,
    role,
    permissions: buildPermissionsForRole(
      role,
      toPermissionResponse(inputPermissions),
    ),
  });

  return user;
}

// ─────────────────────────────────────────
// Update User
// ─────────────────────────────────────────

export async function updateUserService({
  userId,
  username,
  email,
  password,
  role,
  permissionPatch,
  actor: _actor,
}) {
  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const updates = {};
  const previousSnapshot = toUserAuditSnapshot(user);

  if (username !== undefined) {
    if (!isNonEmptyString(username)) {
      throw new AppError("Username cannot be empty", 400);
    }

    username = username.trim();

    if (username.length < 3 || username.length > 30) {
      throw new AppError("Username must be between 3 and 30 characters", 400);
    }

    const existingUsername = await User.findOne({
      username,
      _id: { $ne: userId },
    });

    if (existingUsername) {
      throw new AppError("Username already exists", 409);
    }

    updates.username = username;
  }

  if (email !== undefined) {
    if (!isNonEmptyString(email)) {
      throw new AppError("Email cannot be empty", 400);
    }

    email = email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      throw new AppError("Invalid email format", 400);
    }

    const existingEmail = await User.findOne({
      email,
      _id: { $ne: userId },
    });

    if (existingEmail) {
      throw new AppError("Email already exists", 409);
    }

    updates.email = email;
  }

  if (role !== undefined) {
    if (!isNonEmptyString(role)) {
      throw new AppError("Role cannot be empty", 400);
    }

    const normalizedRole = normalizeRole(role.trim());

    if (!["User", "Admin"].includes(normalizedRole)) {
      throw new AppError("Role must be User or Admin", 400);
    }

    const isDemotingAdmin = user.role === "Admin" && normalizedRole !== "Admin";

    if (isDemotingAdmin) {
      const otherAdmins = await countAdmins(user._id);

      if (otherAdmins === 0) {
        throw new AppError("At least one admin must remain", 400);
      }
    }

    updates.role = normalizedRole;
  }

  if (permissionPatch && Object.keys(permissionPatch).length > 0) {
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
      throw new AppError("At least one superadmin must remain", 400);
    }
  }

  if (password !== undefined && password !== "") {
    if (!isNonEmptyString(password)) {
      throw new AppError("Password cannot be empty", 400);
    }

    password = password.trim();

    if (password.length < 6 || password.length > 100) {
      throw new AppError("Password must be at least 6 characters", 400);
    }

    updates.password = await bcrypt.hash(password, 10);
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    select: "-password",
  });

  return {
    user: updatedUser,
    previousSnapshot,
    changedFields: Object.keys(updates).map((field) =>
      field === "password" ? "passwordChanged" : field,
    ),
  };
}

// ─────────────────────────────────────────
// Soft Delete User
// ─────────────────────────────────────────

export async function softDeleteUserService({ userId, currentUserId }) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isDeleted) {
    throw new AppError("User is already deleted", 400);
  }

  if (user._id.toString() === currentUserId) {
    throw new AppError("You cannot delete your own admin account", 400);
  }

  if (isSuperadminUser(user)) {
    throw new AppError("Superadmin accounts cannot be deleted by admins", 403);
  }

  if (user.role === "Admin") {
    const otherAdmins = await countAdmins(user._id);

    if (otherAdmins === 0) {
      throw new AppError("At least one admin must remain", 400);
    }
  }

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

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    deleteAfter,
  };
}

// ─────────────────────────────────────────
// Restore User
// ─────────────────────────────────────────

export async function restoreUserService(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.isDeleted) {
    throw new AppError("User is not deleted", 400);
  }

  if (user.deleteAfter && user.deleteAfter < new Date()) {
    throw new AppError(
      "Grace period has expired. User can no longer be restored",
      410,
    );
  }

  user.isDeleted = false;
  user.deletedAt = null;
  user.deleteAfter = null;
  await user.save();

  return toUserResponse(user);
}

// ─────────────────────────────────────────
// Hard Delete User
// ─────────────────────────────────────────

export async function hardDeleteUserService({
  userId,
  currentUserId,
  confirmText,
}) {
  if (confirmText !== "DELETE") {
    throw new AppError("Hard delete requires confirmText=DELETE", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user._id.toString() === currentUserId) {
    throw new AppError("You cannot hard delete your own admin account", 400);
  }

  if (isSuperadminUser(user)) {
    throw new AppError("Superadmin accounts cannot be deleted by admins", 403);
  }

  if (!user.isDeleted) {
    throw new AppError(
      "User must be soft deleted before permanent removal",
      400,
    );
  }

  await Booking.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  return {
    id: userId,
    username: user.username,
    role: user.role,
  };
}

// ─────────────────────────────────────────
// Purge Soft Deleted Users
// ─────────────────────────────────────────

export async function purgeSoftDeletedUsersService(now = new Date()) {
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
