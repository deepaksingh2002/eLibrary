import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof multer.MulterError) {
    // Multer errors from file upload middleware
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        statusCode = 413;
        message =
          "File is too large. Please ensure uploads are under the allowed limit.";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        statusCode = 400;
        message = "Unexpected file field in upload.";
        break;
      default:
        statusCode = 400;
        message = err.message || "File upload error";
    }
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((value) => value.message)
      .join(", ");
  } else if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === 11000
  ) {
    statusCode = 409;
    message = "Resource already exists";
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = "Invalid ID";
  } else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = "Token expired";
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = "Invalid token";
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === "development" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
};
