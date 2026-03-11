import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("Missing or invalid Authorization header", 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.id,
      role: payload.role,
    };

    return next();
  } catch (err) {
    return next(new AppError("Invalid or expired token", 401));
  }
}
