import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";

function normalizeRole(role) {
  return (role || "").toLowerCase() === "admin" ? "Admin" : "User";
}

export async function createUserService({
  username,
  email,
  password,
  role = "User",
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

  const user = await User.create({
    username,
    email,
    password: hash,
    role,
  });

  return user;
}
