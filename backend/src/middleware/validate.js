import { AppError } from "../utils/appError.js";
import { isValidObjectId } from "../utils/validation.js";

export function validateObjectIdParam(paramName) {
  return function validateObjectId(req, _res, next) {
    const value = req.params?.[paramName];

    if (!isValidObjectId(value)) {
      return next(new AppError(`Invalid ${paramName}`, 400));
    }

    return next();
  };
}
