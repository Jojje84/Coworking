import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { AppError } from "../utils/AppError.js";
import { isValidEmail, isNonEmptyString } from "../utils/validation.js";
import { createUserService } from "../services/userService.js";

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
  const query = { role: "Admin" };

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
    const users = await User.find().select("-password").sort({ createdAt: -1 });
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
    const user = await createUserService({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || "User",
    });

    const payload = toUserResponse(user);

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

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    let { username, email, password, role } = req.body;
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

    if (user._id.toString() === currentUserId) {
      return next(
        new AppError("You cannot delete your own admin account", 400),
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

    await Booking.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    try {
      emitUserEvent(req, "user:deleted", deletedPayload);
    } catch (socketErr) {
      console.error("user:deleted emit error:", socketErr);
    }

    return res.json({ message: "User and related bookings deleted" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────
// Get Own Profile
// ─────────────────────────────────────────

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password");

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
    const user = await User.findById(req.user.id);

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
