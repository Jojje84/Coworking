import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { PERMISSION_KEYS, hasPermission } from "../utils/permissions.js";

export function requirePermission(permissionKey) {
  return async function permissionMiddleware(req, res, next) {
    try {
      if (!req.user?.id) {
        return next(new AppError("Not authenticated", 401));
      }

      if (!PERMISSION_KEYS.includes(permissionKey)) {
        return next(new AppError("Invalid permission requirement", 500));
      }

      const user = await User.findById(req.user.id).select(
        "permissions isDeleted",
      );

      if (!user || user.isDeleted) {
        return next(new AppError("User is inactive or deleted", 401));
      }

      if (!hasPermission(user, permissionKey)) {
        return next(new AppError("Permission required", 403));
      }

      req.user.permissions = user.permissions;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
