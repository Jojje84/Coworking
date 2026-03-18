import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import { createUserService } from "../services/userService.js";
import { getJwtSecret } from "../config/env.js";
import { toPermissionResponse } from "../utils/permissions.js";
import { getOrCreateAppSettings } from "../services/settingsService.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
}

function toUserResponse(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: toPermissionResponse(user.permissions),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function emitUserCreated(req, payload) {
  const io = req.app.get("io");
  if (!io) return;

  if (payload?.id) {
    io.to(payload.id).emit("user:created", payload);
  }

  io.to("admins").emit("user:created", payload);
}

// ─────────────────────────────────────────
// Register
// ─────────────────────────────────────────

export async function register(req, res, next) {
  try {
    const settings = await getOrCreateAppSettings();

    if (!settings.allowSelfRegistration) {
      return next(
        new AppError("Self registration is currently disabled", 403),
      );
    }

    const user = await createUserService({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: "User",
    });

    const payload = toUserResponse(user);

    await safeRecordAuditLog({
      req,
      action: "auth.register",
      actorId: user._id,
      actorRole: user.role,
      targetType: "user",
      targetId: payload.id,
      summary: `User ${payload.username} registered`,
      metadata: {
        role: payload.role,
      },
    });

    try {
      emitUserCreated(req, payload);
    } catch (socketErr) {
      console.error("user:created emit error from register:", socketErr);
    }

    return res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────

export async function login(req, res, next) {
  try {
    let { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      await safeRecordAuditLog({
        req,
        action: "auth.login_failed",
        targetType: "auth",
        summary: "Login failed: missing credentials",
        metadata: {
          reason: "missing_credentials",
          email: typeof email === "string" ? email.trim().toLowerCase() : "",
        },
      });
      return next(new AppError("email and password are required", 400));
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    if (!isValidEmail(email)) {
      await safeRecordAuditLog({
        req,
        action: "auth.login_failed",
        targetType: "auth",
        summary: "Login failed: invalid email format",
        metadata: {
          reason: "invalid_email_format",
          email,
        },
      });
      return next(new AppError("Invalid email format", 400));
    }

    const user = await User.findOne({
      email,
      isDeleted: { $ne: true },
    });

    if (!user) {
      await safeRecordAuditLog({
        req,
        action: "auth.login_failed",
        targetType: "auth",
        summary: "Login failed: invalid credentials",
        metadata: {
          reason: "invalid_credentials",
          email,
        },
      });
      return next(new AppError("Invalid credentials", 401));
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      await safeRecordAuditLog({
        req,
        action: "auth.login_failed",
        actorId: user._id,
        actorRole: user.role,
        targetType: "auth",
        summary: "Login failed: invalid credentials",
        metadata: {
          reason: "invalid_credentials",
          email,
          userId: user._id.toString(),
        },
      });
      return next(new AppError("Invalid credentials", 401));
    }

    const token = signToken(user);

    await safeRecordAuditLog({
      req,
      action: "auth.login_succeeded",
      actorId: user._id,
      actorRole: user.role,
      targetType: "auth",
      targetId: user._id,
      summary: `User ${user.username} logged in`,
      metadata: {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    });

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: toPermissionResponse(user.permissions),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
