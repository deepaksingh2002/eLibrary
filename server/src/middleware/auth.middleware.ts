import { NextFunction, Request, Response } from "express";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";

export const protect = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Not authorized to access this route"));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new ApiError(401, "Not authorized to access this route"));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string,
    ) as {
      id: string;
      role: "admin" | "user" | "guest";
    };
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new ApiError(401, "Token expired"));
    }
    if (error instanceof JsonWebTokenError) {
      return next(new ApiError(401, "Invalid token"));
    }
    return next(new ApiError(401, "Invalid token"));
  }
};
