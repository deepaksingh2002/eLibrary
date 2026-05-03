import { Router } from "express";
import { Types } from "mongoose";
import cloudinary, { uploadCover } from "../config/cloudinary";
import { protect } from "../middleware/auth.middleware";
import { ReadingProgress } from "../models/ReadingProgress";
import { User } from "../models/User";
import { UserActivity } from "../models/UserActivity";
import { getMonthlyGoalProgress } from "../services/goalService";
import { getStreakStatus } from "../services/streakService";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(protect);

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.get("/me/dashboard", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const [
    user,
    continueReading,
    recentlyCompleted,
    goalProgress,
    recentActivity,
    weeklyActivityRaw,
  ] = await Promise.all([
    User.findById(userId).select(
      "name email avatar streak longestStreak monthlyGoal totalBooksRead totalMinutesRead lastActiveDate preferences"
    ).lean(),
    ReadingProgress.find({ userId, status: "in-progress", progress: { $gt: 0 } })
      .sort({ lastRead: -1 })
      .limit(5)
      .populate("bookId", "title author coverUrl avgRating genre")
      .lean(),
    ReadingProgress.find({ userId, status: "completed" })
      .sort({ updatedAt: -1 })
      .limit(4)
      .populate("bookId", "title author coverUrl")
      .lean(),
    getMonthlyGoalProgress(userId),
    UserActivity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("bookId", "title author coverUrl")
      .lean(),
    UserActivity.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          eventType: "progress",
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sessions: { $sum: 1 },
        },
      },
    ]),
  ]);

  if (!user) throw new ApiError(404, "User not found");

  const streakStatus = getStreakStatus(user);
  const weeklyActivityMap = new Map<string, number>(
    weeklyActivityRaw.map((entry) => [entry._id, entry.sessions])
  );

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo);
    date.setUTCDate(sevenDaysAgo.getUTCDate() + index);
    const key = utcDateKey(date);
    return { date: key, sessions: weeklyActivityMap.get(key) ?? 0 };
  });

  res.status(200).json({
    user: {
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      streak: streakStatus.streak,
      longestStreak: streakStatus.longestStreak,
      totalBooksRead: user.totalBooksRead || 0,
      totalMinutesRead: user.totalMinutesRead || 0,
      monthlyGoal: user.monthlyGoal || 0,
      isActiveToday: streakStatus.isActiveToday,
    },
    continueReading: continueReading.filter((progress) => progress.bookId),
    recentlyCompleted: recentlyCompleted.filter((progress) => progress.bookId),
    goalProgress,
    recentActivity: recentActivity.filter((activity) => activity.bookId),
    weeklyActivity,
  });
}));

router.patch("/me/goal", asyncHandler(async (req, res) => {
  const monthlyGoal = Number(req.body.monthlyGoal);

  if (!Number.isInteger(monthlyGoal) || monthlyGoal < 0 || monthlyGoal > 100) {
    throw new ApiError(400, "monthlyGoal must be an integer between 0 and 100");
  }

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { monthlyGoal: parseInt(String(monthlyGoal), 10) },
    { new: true }
  ).select("monthlyGoal");

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json({ monthlyGoal: user.monthlyGoal });
}));

router.patch("/me/profile", asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;
  const update: { name?: string; avatar?: string } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 80) {
      throw new ApiError(400, "Name must be a string between 2 and 80 characters");
    }
    update.name = name.trim();
  }

  if (avatar !== undefined) {
    if (typeof avatar !== "string" || !avatar.startsWith("http")) {
      throw new ApiError(400, "Avatar must be a valid URL string");
    }
    update.avatar = avatar;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: update },
    { new: true, runValidators: true }
  ).select("name email avatar role preferences streak monthlyGoal");

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(user);
}));

router.patch("/me/preferences", asyncHandler(async (req, res) => {
  const { genres, language } = req.body as { genres?: string[]; language?: string };
  const update: Record<string, unknown> = {};

  if (genres !== undefined) {
    if (!Array.isArray(genres) || genres.length > 5) {
      throw new ApiError(400, "genres must be an array with at most 5 entries");
    }
    if (genres.some((genre) => typeof genre !== "string" || genre.length > 50)) {
      throw new ApiError(400, "each genre must be a string up to 50 characters");
    }
    update["preferences.genres"] = genres;
  }

  if (language !== undefined) {
    if (!["en", "hi", "es", "fr", "de"].includes(language)) {
      throw new ApiError(400, "language must be one of en, hi, es, fr, de");
    }
    update["preferences.language"] = language;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No preferences provided");
  }

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: update },
    { new: true }
  ).select("preferences");

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(user.preferences);
}));

router.patch("/me/avatar", uploadCover, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, "User not found");

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  if (!files?.cover?.length) {
    throw new ApiError(400, "Please upload an avatar image");
  }

  if (user.avatarPublicId) {
    try {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    } catch (error) {
      console.error("Failed to delete old avatar:", error);
    }
  }

  const avatarFile = files.cover[0];
  user.avatar = avatarFile.path;
  user.avatarPublicId = avatarFile.filename;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ avatar: user.avatar });
}));

router.get("/me/stats", asyncHandler(async (req, res) => {
  const userId = req.user!.id;

  const [user, byStatusRaw, favouriteGenreRaw, longestSessionRaw] = await Promise.all([
    User.findById(userId).select("totalMinutesRead totalBooksRead"),
    ReadingProgress.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ReadingProgress.aggregate([
      { $match: { userId: new Types.ObjectId(userId), status: "completed" } },
      {
        $lookup: {
          from: "books",
          localField: "bookId",
          foreignField: "_id",
          as: "book",
        },
      },
      { $unwind: "$book" },
      { $group: { _id: "$book.genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    ReadingProgress.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $unwind: "$sessions" },
      { $sort: { "sessions.minutesRead": -1 } },
      { $limit: 1 },
      { $project: { minutes: "$sessions.minutesRead" } },
    ]),
  ]);

  if (!user) throw new ApiError(404, "User not found");

  const byStatus = {
    "not-started": 0,
    "in-progress": 0,
    "completed": 0,
  };

  byStatusRaw.forEach((entry) => {
    if (entry._id in byStatus) {
      byStatus[entry._id as keyof typeof byStatus] = entry.count;
    }
  });

  res.status(200).json({
    totalBooksRead: user.totalBooksRead,
    totalMinutesRead: user.totalMinutesRead,
    totalHoursRead: Math.round((user.totalMinutesRead ?? 0) / 60),
    byStatus,
    favouriteGenre: favouriteGenreRaw[0]?._id ?? null,
    longestSessionMinutes: longestSessionRaw[0]?.minutes ?? 0,
  });
}));

export default router;
