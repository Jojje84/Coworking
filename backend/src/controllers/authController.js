import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import { createUserService } from "../services/userService.js";

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
}

function toUserResponse(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
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

export async function register(req, res, next) {
  try {
    const user = await createUserService({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: "User",
    });

    const payload = toUserResponse(user);

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

export async function login(req, res, next) {
  try {
    let { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return next(new AppError("email and password are required", 400));
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    if (!isValidEmail(email)) {
      return next(new AppError("Invalid email format", 400));
    }

    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError("Invalid credentials", 401));
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return next(new AppError("Invalid credentials", 401));
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
