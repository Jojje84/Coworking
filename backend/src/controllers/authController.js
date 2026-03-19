import { AppError } from "../utils/appError.js";
import { createUserService } from "../services/userService.js";
import { getOrCreateAppSettings } from "../services/settingsService.js";
import { safeRecordAuditLog } from "../services/auditLogService.js";
import { emitUserEvent } from "../services/notificationService.js";
import { User } from "../models/User.js";
import {
  signToken,
  validateLoginCredentials,
  buildAuthResponse,
} from "../services/authService.js";
import { logger } from "../utils/logger.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "cowork_token";

function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
}

// ─────────────────────────────────────────
// Register
// ─────────────────────────────────────────

export async function register(req, res, next) {
  try {
    const settings = await getOrCreateAppSettings();

    if (!settings.allowSelfRegistration) {
      return next(new AppError("Self registration is currently disabled", 403));
    }

    const user = await createUserService({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: "User",
    });

    const payload = buildAuthResponse(user);

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
      emitUserEvent(req, "user:created", payload);
    } catch (socketErr) {
      logger.error("user:created emit error from register:", socketErr);
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
    const user = await validateLoginCredentials({
      email: req.body.email,
      password: req.body.password,
    });

    const token = signToken(user);

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

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
      user: buildAuthResponse(user),
    });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) {
      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
      await safeRecordAuditLog({
        req,
        action: "auth.login_failed",
        targetType: "auth",
        summary: "Login failed: invalid credentials",
        metadata: {
          reason: "invalid_credentials",
          email,
        },
      }).catch(() => {});
    }
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findOne({
      _id: req.user.id,
      isDeleted: { $ne: true },
    });

    if (!user) {
      return next(new AppError("User is inactive or deleted", 401));
    }

    const token = signToken(user);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.json({
      token,
      user: buildAuthResponse(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());

    await safeRecordAuditLog({
      req,
      action: "auth.logout",
      actorId: req.user?.id,
      actorRole: req.user?.role,
      targetType: "auth",
      targetId: req.user?.id,
      summary: "User logged out",
      metadata: {
        userId: req.user?.id,
      },
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
