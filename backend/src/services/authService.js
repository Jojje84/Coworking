import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { AppError } from "../utils/appError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import { toPermissionResponse } from "../utils/permissions.js";
import { getJwtSecret } from "../config/env.js";

// ─────────────────────────────────────────
// Sign Token
// ─────────────────────────────────────────

export function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
}

// ─────────────────────────────────────────
// Validate Login Credentials
// ─────────────────────────────────────────

export async function validateLoginCredentials({ email, password }) {
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new AppError("email and password are required", 400);
  }

  email = email.trim().toLowerCase();
  password = password.trim();

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const user = await User.findOne({
    email,
    isDeleted: { $ne: true },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  return user;
}

// ─────────────────────────────────────────
// Build Auth Response
// ─────────────────────────────────────────

export function buildAuthResponse(user) {
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
