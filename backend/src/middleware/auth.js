import jwt from "jsonwebtoken";

import { getJwtSecret } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/appError.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "cowork_token";

function readCookieToken(req) {
  const cookieHeader = req.headers.cookie || "";
  if (!cookieHeader) return "";

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${AUTH_COOKIE_NAME}=`)) continue;

    const value = trimmed.slice(AUTH_COOKIE_NAME.length + 1);
    if (!value) return "";

    try {
      return decodeURIComponent(value);
    } catch (_err) {
      return value;
    }
  }

  return "";
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  const cookieToken = readCookieToken(req);
  const resolvedToken = scheme === "Bearer" && token ? token : cookieToken;

  if (!resolvedToken) {
    return next(new AppError("Missing or invalid authentication token", 401));
  }

  try {
    const payload = jwt.verify(resolvedToken, getJwtSecret());
    const currentUser = await User.findById(payload.id).select(
      "role isDeleted",
    );

    if (!currentUser || currentUser.isDeleted) {
      return next(new AppError("User is inactive or deleted", 401));
    }

    req.user = {
      id: payload.id,
      role: currentUser.role,
    };

    return next();
  } catch (_err) {
    return next(new AppError("Invalid or expired token", 401));
  }
}
