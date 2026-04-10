import { User } from "../models/User.js";
import { AppError } from "../utils/appError.js";

export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) {
      return next(new AppError("Not authenticated", 401));
    }

    const currentUser = await User.findById(req.user.id).select(
      "role isDeleted",
    );

    if (!currentUser) {
      return next(new AppError("User not found", 401));
    }

    if (currentUser.isDeleted) {
      return next(new AppError("User is inactive or deleted", 401));
    }

    req.user.role = currentUser.role;

    if ((currentUser.role || "").toLowerCase() !== "admin") {
      return next(new AppError("Admin access required", 403));
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
