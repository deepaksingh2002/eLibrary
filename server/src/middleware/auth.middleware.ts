import { NextFunction, Request, Response } from "express";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";

export const protect = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const path = req.path;
  const method = req.method;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`[Auth] Unauthorized access to ${method} ${path} - No auth header`);
    return next(new ApiError(401, "Not authorized to access this route"));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    console.log(`[Auth] Unauthorized access to ${method} ${path} - Empty token`);
    return next(new ApiError(401, "Not authorized to access this route"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as {
      id: string;
      role: "admin" | "user" | "guest";
    };
    req.user = { id: decoded.id, role: decoded.role };
    console.log(`[Auth] Authorized ${method} ${path} - userId=${decoded.id}`);
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.log(`[Auth] Token expired for ${method} ${path}`);
      return next(new ApiError(401, "Token expired"));
    }
    if (error instanceof JsonWebTokenError) {
      console.log(`[Auth] Invalid token for ${method} ${path}`);
      return next(new ApiError(401, "Invalid token"));
    }
    console.log(`[Auth] Token verification failed for ${method} ${path}`);
    return next(new ApiError(401, "Invalid token"));
  }
};
