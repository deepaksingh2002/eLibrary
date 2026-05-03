import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You are not authorized to access this route"));
    }

    next();
  };
};
