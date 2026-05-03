import express from "express";
import hpp from "hpp";
import crypto from "crypto";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler";
import authRouter from "./routes/auth.routes";
import bookRouter from "./routes/book.routes";
import progressRouter from "./routes/progress.routes";
import reviewRouter from "./routes/review.routes";
import userRouter from "./routes/user.routes";
import recommendationRouter from "./routes/recommendation.routes";
import adminRouter from "./routes/admin.routes";
import { ApiError } from "./utils/ApiError";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:3000"
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
  exposedHeaders: ["Content-Disposition"]
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after a minute"
});

const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many login/register attempts, please try again after a minute"
});

app.use(globalLimiter);
app.use((req, res, next) => {
  res.setHeader("X-Request-ID", crypto.randomUUID());
  next();
});

app.use("/api/auth", authRateLimiter, authRouter);
app.use("/api/books", bookRouter);
app.use("/api/progress", progressRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/users", userRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0"
  });
});

app.get("/ready", (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(503).json({
      status: "not ready",
      database: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
  res.status(200).json({
    status: "ready",
    database: "connected",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  next(new ApiError(404, "Route not found"));
});

app.use(errorHandler);

export default app;
