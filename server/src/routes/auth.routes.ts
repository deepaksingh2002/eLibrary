import { CookieOptions, Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { protect } from "../middleware/auth.middleware";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from "../services/emailService";


const router = Router();
const isProduction = process.env.NODE_ENV === "production";
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: refreshCookieMaxAge,
};
const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { id: userId, role },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES || "15m") as any }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES || "7d") as any }
  );

  return { accessToken, refreshToken };
};

const serializeUser = (user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

router.post("/register", asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Please provide all required fields");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Please provide a valid email");
  }

  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "Email is already taken");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: password,
  });

  const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.role);

  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  void sendWelcomeEmail({ to: user.email, name: user.name });
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  res.status(201).json({
    user: serializeUser(user),
    accessToken
  });
}));

router.post("/login", asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Please provide email and password");
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail, isDeleted: false }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.role);

  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  res.status(200).json({
    user: serializeUser(user),
    accessToken
  });
}));

router.post("/refresh", asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies.refreshToken as string | undefined;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Not authorized");
  }

  try {
    const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET as string) as { id: string };
    const user = await User.findOne({
      _id: decoded.id,
      isDeleted: false,
      refreshTokens: incomingRefreshToken,
    });

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id.toString(), user.role);

    // Rotate token
    user.refreshTokens = user.refreshTokens.filter(t => t !== incomingRefreshToken);
    user.refreshTokens.push(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

    res.status(200).json({ accessToken });
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
}));

router.post("/logout", asyncHandler(async (req, res, next) => {
  const incomingRefreshToken = req.cookies.refreshToken as string | undefined;

  if (!incomingRefreshToken) {
    res.clearCookie("refreshToken", clearRefreshCookieOptions);
    return res.status(200).json({ message: "Logged out" });
  }

  try {
    const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET as string) as { id: string };
    const user = await User.findById(decoded.id);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(t => t !== incomingRefreshToken);
      await user.save({ validateBeforeSave: false });
    }
  } catch (error) {
    // Ignore token verification errors on logout
  }

  res.clearCookie("refreshToken", clearRefreshCookieOptions);
  res.status(200).json({ message: "Logged out" });
}));

router.post("/logout-all", protect, asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user!.id);
  if (user) {
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
  }

  res.clearCookie("refreshToken", clearRefreshCookieOptions);
  res.status(200).json({ message: "Logged out of all devices" });
}));

router.get("/me", protect, asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user!.id).select("-passwordHash -refreshTokens -isDeleted");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    user
  });
}));

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: "Too many reset requests. Try again in 15 minutes." }
});

router.post("/forgot-password", forgotPasswordLimiter, asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(200).json({ message: "If email is registered a reset link was sent" });
  }

  const user = await User.findOne({ email: normalizeEmail(email), isDeleted: false });
  if (!user) {
    return res.status(200).json({ message: "If email is registered a reset link was sent" });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || "30") * 60 * 1000);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = expires;
  await user.save({ validateBeforeSave: false });

  void sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetToken: rawToken,
    expiresInMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || "30")
  });

  res.status(200).json({ message: "If email is registered a reset link was sent" });
}));

router.post("/reset-password", forgotPasswordLimiter, asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;

  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Reset token is invalid or has expired");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
    isDeleted: false
  }).select("+passwordHash");

  if (!user) {
    throw new ApiError(400, "Reset token is invalid or has expired");
  }

  const isSame = await user.comparePassword(newPassword);
  if (isSame) {
    throw new ApiError(400, "New password must be different from current password");
  }

  user.passwordHash = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  void sendPasswordChangedEmail({ to: user.email, name: user.name });

  res.status(200).json({ message: "Password reset successful" });
}));

export default router;
