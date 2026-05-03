import { Router } from "express";
import { Types } from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ReadingProgress } from "../models/ReadingProgress";
import { UserActivity } from "../models/UserActivity";
import { User } from "../models/User";
import { Book } from "../models/Book";
import { updateStreak } from "../services/streakService";
import { logActivity } from "../middleware/activityLogger";

const router = Router();

router.use(protect);

router.patch(
  "/:bookId",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const userId = req.user!.id;
    const { progress, sessionMinutes } = req.body;

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const progressNum = Number(progress);
    if (Number.isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
      throw new ApiError(400, "Progress must be a number between 0 and 100");
    }

    const book = await Book.findOne({ _id: bookId, isDeleted: false });
    if (!book) throw new ApiError(404, "Book not found");

    const newStatus =
      progressNum === 100 ? "completed" :
      progressNum > 0 ? "in-progress" :
      "not-started";

    const existing = await ReadingProgress.findOne({ userId, bookId });
    const wasAlreadyCompleted = existing?.status === "completed";

    const updateObj: any = {
      $set: {
        progress: progressNum,
        status: newStatus,
        lastRead: new Date()
      }
    };

    const sessionMins = Number(sessionMinutes) || 0;
    if (sessionMins > 0) {
      updateObj.$push = {
        sessions: {
          startTime: new Date(Date.now() - sessionMins * 60_000),
          endTime: new Date(),
          minutesRead: sessionMins
        }
      };
    }

    const updated = await ReadingProgress.findOneAndUpdate(
      { userId, bookId },
      updateObj,
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    if (sessionMins > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { totalMinutesRead: sessionMins }
      });
    }

    if (progressNum === 100 && !wasAlreadyCompleted) {
      await User.findByIdAndUpdate(userId, {
        $inc: { totalBooksRead: 1 }
      });
      logActivity({ userId, bookId, eventType: "complete" });
    }

    updateStreak(userId).catch((err) =>
      console.error("[Progress] Streak update failed:", err)
    );

    logActivity({
      userId,
      bookId,
      eventType: "progress",
      metadata: { progress: progressNum }
    });

    res.json({ progress: updated });
  })
);

router.get(
  "/:bookId",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const progress = await ReadingProgress.findOne({ userId, bookId }).lean();

    if (!progress) {
      return res.json({
        progress: {
          progress: 0,
          status: "not-started",
          sessions: [],
          bookmarks: [],
          lastRead: null
        }
      });
    }

    res.json({ progress });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const filter: any = { userId };
    if (status) filter.status = status;

    const [progressList, total] = await Promise.all([
      ReadingProgress.find(filter)
        .sort({ lastRead: -1 })
        .skip(skip)
        .limit(limit)
        .populate("bookId", "title author coverUrl genre avgRating totalReviews")
        .lean(),
      ReadingProgress.countDocuments(filter)
    ]);

    res.json({
      progressList,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  })
);

router.get(
  "/shelf/continue-reading",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const shelf = await ReadingProgress.find({
      userId,
      status: "in-progress",
      progress: { $gt: 0, $lt: 100 }
    })
      .sort({ lastRead: -1 })
      .limit(10)
      .populate("bookId", "title author coverUrl genre avgRating")
      .lean();

    res.json({ shelf });
  })
);

router.get(
  "/shelf/completed",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const completed = await ReadingProgress.find({
      userId,
      status: "completed"
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate("bookId", "title author coverUrl genre avgRating")
      .lean();

    res.json({ completed });
  })
);

router.post(
  "/:bookId/bookmarks",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const userId = req.user!.id;
    const { page, note = "" } = req.body;

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }
    if (!page || Number.isNaN(Number(page)) || Number(page) < 1) {
      throw new ApiError(400, "Valid page number is required");
    }

    let prog = await ReadingProgress.findOne({ userId, bookId });
    if (!prog) {
      prog = await ReadingProgress.create({
        userId,
        bookId,
        progress: 0,
        status: "not-started"
      });
    }

    if (prog.bookmarks.length >= 50) {
      throw new ApiError(400, "Maximum 50 bookmarks per book reached");
    }

    const duplicate = prog.bookmarks.find((b) => b.page === Number(page));
    if (duplicate) {
      throw new ApiError(409, "A bookmark already exists for this page");
    }

    prog.bookmarks.push({
      page: Number(page),
      note: String(note).trim().slice(0, 500),
      createdAt: new Date()
    } as any);
    await prog.save();

    logActivity({ userId, bookId, eventType: "bookmark" });

    res.status(201).json({
      bookmark: prog.bookmarks[prog.bookmarks.length - 1],
      total: prog.bookmarks.length
    });
  })
);

router.get(
  "/:bookId/bookmarks",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const prog = await ReadingProgress.findOne({ userId, bookId }).lean();

    if (!prog) return res.json({ bookmarks: [] });

    const sorted = [...(prog.bookmarks || [])].sort((a, b) => a.page - b.page);

    res.json({ bookmarks: sorted });
  })
);

router.patch(
  "/:bookId/bookmarks/:bookmarkId",
  asyncHandler(async (req, res) => {
    const { bookId, bookmarkId } = req.params;
    const userId = req.user!.id;
    const { note } = req.body;

    if (!Types.ObjectId.isValid(bookId) || !Types.ObjectId.isValid(bookmarkId)) {
      throw new ApiError(400, "Invalid bookmark request");
    }

    const result = await ReadingProgress.updateOne(
      {
        userId,
        bookId,
        "bookmarks._id": new Types.ObjectId(bookmarkId)
      },
      {
        $set: {
          "bookmarks.$.note": String(note || "").trim().slice(0, 500)
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError(404, "Bookmark not found");
    }

    res.json({ message: "Bookmark updated" });
  })
);

router.delete(
  "/:bookId/bookmarks/:bookmarkId",
  asyncHandler(async (req, res) => {
    const { bookId, bookmarkId } = req.params;
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(bookId) || !Types.ObjectId.isValid(bookmarkId)) {
      throw new ApiError(400, "Invalid bookmark request");
    }

    const result = await ReadingProgress.updateOne(
      { userId, bookId },
      {
        $pull: {
          bookmarks: { _id: new Types.ObjectId(bookmarkId) }
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError(404, "Bookmark not found");
    }

    res.json({ message: "Bookmark deleted" });
  })
);

export default router;
