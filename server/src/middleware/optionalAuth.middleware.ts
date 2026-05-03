import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

type AccessTokenPayload = {
  id: string;
  role: "admin" | "user" | "guest";
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AccessTokenPayload;
    req.user = { id: decoded.id, role: decoded.role };
  } catch {
    // Public routes should remain accessible even with a bad token.
  }

  next();
};
