import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";
import { getJwtSecret } from "../config/env.js";
import { User } from "../models/User.js";

// ─────────────────────────────────────────
// Authentication Middleware
// ─────────────────────────────────────────

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("Missing or invalid Authorization header", 401));
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    const currentUser = await User.findById(payload.id).select("role isDeleted");
    if (!currentUser || currentUser.isDeleted) {
      return next(new AppError("User is inactive or deleted", 401));
    }

    req.user = {
      id: payload.id,
      role: currentUser.role,
    };

    return next();
  } catch (err) {
    return next(new AppError("Invalid or expired token", 401));
  }
}
