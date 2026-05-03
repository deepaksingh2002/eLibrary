import { Router } from "express";
import { Types } from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { logActivity } from "../middleware/activityLogger";
import { Book } from "../models/Book";
import { ReadingProgress } from "../models/ReadingProgress";
import { User } from "../models/User";
import { updateStreak } from "../services/streakService";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { isValidObjectId, paginationParams, sanitizeString } from "../utils/validate";

const router = Router();

router.use(protect);

function normalizeProgressStatus(progress: number): "not-started" | "in-progress" | "completed" {
  if (progress === 100) return "completed";
  if (progress > 0) return "in-progress";
  return "not-started";
}

router.get("/shelf/continue-reading", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const progressList = await ReadingProgress.find({
    userId,
    status: "in-progress",
    progress: { $gt: 0, $lt: 100 },
  })
    .sort({ lastRead: -1 })
    .limit(10)
    .populate("bookId", "title author coverUrl avgRating genre");

  res.status(200).json(progressList);
}));

router.get("/shelf/completed", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const progressList = await ReadingProgress.find({
    userId,
    status: "completed",
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .populate("bookId", "title author coverUrl avgRating genre");

  res.status(200).json(progressList);
}));

router.get("/", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const paginationQuery = { ...req.query, limit: req.query.limit ?? "10" };
  const { page, limit, skip } = paginationParams(paginationQuery);
  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = { userId };

  if (status) {
    if (!["in-progress", "completed", "not-started"].includes(status)) {
      throw new ApiError(400, "Invalid status filter");
    }
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    ReadingProgress.find(filter)
      .sort({ lastRead: -1 })
      .skip(skip)
      .limit(limit)
      .populate("bookId", "title author coverUrl genre avgRating totalReviews"),
    ReadingProgress.countDocuments(filter),
  ]);

  res.status(200).json({
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}));

router.post("/:bookId/bookmarks", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;
  const { page, note } = req.body;

  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");
  if (!Number.isInteger(page) || page <= 0) {
    throw new ApiError(400, "page must be a positive integer");
  }
  if (note !== undefined && typeof note !== "string") {
    throw new ApiError(400, "note must be a string");
  }
  if (typeof note === "string" && note.length > 500) {
    throw new ApiError(400, "note must be 500 characters or fewer");
  }

  let progressDoc = await ReadingProgress.findOne({ userId, bookId });

  if (!progressDoc) {
    progressDoc = await ReadingProgress.findOneAndUpdate(
      { userId, bookId },
      {
        $setOnInsert: {
          userId,
          bookId,
          progress: 0,
          status: "not-started",
          sessions: [],
          bookmarks: [],
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  if (!progressDoc) throw new ApiError(500, "Failed to initialize reading progress");
  if (progressDoc.bookmarks.length >= 50) throw new ApiError(400, "Maximum 50 bookmarks per book");
  if (progressDoc.bookmarks.some((bookmark) => bookmark.page === page)) {
    throw new ApiError(409, "Bookmark already exists for this page");
  }

  const sanitizedNote = typeof note === "string" ? sanitizeString(note) : "";

  const updatedDoc = await ReadingProgress.findOneAndUpdate(
    { userId, bookId },
    {
      $push: {
        bookmarks: { page, note: sanitizedNote, createdAt: new Date() },
      },
    },
    { new: true, runValidators: true }
  );

  if (!updatedDoc) throw new ApiError(404, "Reading progress not found");

  const newBookmark = updatedDoc.bookmarks[updatedDoc.bookmarks.length - 1];
  logActivity({ userId, bookId, eventType: "bookmark", metadata: { page } });

  res.status(201).json({ bookmark: newBookmark, total: updatedDoc.bookmarks.length });
}));

router.get("/:bookId/bookmarks", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const progressDoc = await ReadingProgress.findOne({ userId, bookId });

  if (!progressDoc) {
    return res.status(200).json({ bookmarks: [] });
  }

  const bookmarks = [...progressDoc.bookmarks].sort((a, b) => a.page - b.page);
  res.status(200).json({ bookmarks });
}));

router.patch("/:bookId/bookmarks/:bookmarkId", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId, bookmarkId } = req.params;
  const { note } = req.body;

  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");
  if (!isValidObjectId(bookmarkId)) throw new ApiError(400, "Invalid bookmark id");
  if (typeof note !== "string") throw new ApiError(400, "note is required");
  if (note.length > 500) throw new ApiError(400, "note must be 500 characters or fewer");

  const sanitizedNote = sanitizeString(note);

  const updateResult = await ReadingProgress.updateOne(
    { userId, bookId, "bookmarks._id": bookmarkId },
    { $set: { "bookmarks.$.note": sanitizedNote } }
  );

  if (updateResult.matchedCount === 0) {
    throw new ApiError(404, "Bookmark not found");
  }

  const progressDoc = await ReadingProgress.findOne({ userId, bookId });
  const bookmark = progressDoc?.bookmarks.find((entry) => entry._id?.toString() === bookmarkId);

  res.status(200).json({ bookmark });
}));

router.delete("/:bookId/bookmarks/:bookmarkId", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId, bookmarkId } = req.params;

  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");
  if (!isValidObjectId(bookmarkId)) throw new ApiError(400, "Invalid bookmark id");

  const objectId = new Types.ObjectId(bookmarkId);
  const updateResult = await ReadingProgress.updateOne(
    { userId, bookId, "bookmarks._id": objectId },
    { $pull: { bookmarks: { _id: objectId } } }
  );

  if (updateResult.matchedCount === 0) {
    throw new ApiError(404, "Bookmark not found");
  }

  res.status(200).json({ message: "Bookmark removed" });
}));

router.patch("/:bookId", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;
  const { progress, sessionMinutes } = req.body as { progress: number; sessionMinutes?: number };

  console.log(`[Progress PATCH] userId=${userId}, bookId=${bookId}, progress=${progress}, sessionMinutes=${sessionMinutes}`);

  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");
  if (typeof progress !== "number" || Number.isNaN(progress) || progress < 0 || progress > 100) {
    throw new ApiError(400, "progress must be a number between 0 and 100");
  }
  if (sessionMinutes !== undefined && (!Number.isFinite(sessionMinutes) || sessionMinutes <= 0)) {
    throw new ApiError(400, "sessionMinutes must be a positive number");
  }

  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new ApiError(404, "Book not found");

  const existing = await ReadingProgress.findOne({ userId, bookId });
  const wasAlreadyComplete = existing?.status === "completed";
  const hasEverCompleted = Boolean(existing?.completedAt);
  const nextStatus = normalizeProgressStatus(progress);

  console.log(`[Progress PATCH] Existing status=${existing?.status}, nextStatus=${nextStatus}, hasEverCompleted=${hasEverCompleted}`);

  const progressDoc = await ReadingProgress.findOneAndUpdate(
    { userId, bookId },
    {
      $set: {
        userId,
        bookId,
        progress,
        status: nextStatus,
        lastRead: new Date(),
        ...(progress === 100 && !hasEverCompleted ? { completedAt: new Date() } : {}),
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log(`[Progress PATCH] Saved successfully:`, {
    id: progressDoc?._id,
    progress: progressDoc?.progress,
    status: progressDoc?.status
  });

  if (!progressDoc) throw new ApiError(500, "Failed to update reading progress");

  if (sessionMinutes && sessionMinutes > 0) {
    await Promise.all([
      ReadingProgress.updateOne(
        { _id: progressDoc._id },
        {
          $push: {
            sessions: {
              startTime: new Date(Date.now() - sessionMinutes * 60000),
              endTime: new Date(),
              minutesRead: sessionMinutes,
            },
          },
        }
      ),
      User.findByIdAndUpdate(userId, { $inc: { totalMinutesRead: sessionMinutes } }, { new: true }),
    ]);
  }

  if (!hasEverCompleted && !wasAlreadyComplete && nextStatus === "completed") {
    await User.findByIdAndUpdate(userId, { $inc: { totalBooksRead: 1 } }, { new: true });
    logActivity({ userId, bookId, eventType: "complete" });
  }

  void updateStreak(userId).catch((error) => {
    console.error("Failed to update streak:", error);
  });

  logActivity({
    userId,
    bookId,
    eventType: "progress",
    metadata: { progress },
  });

  const updatedDoc = await ReadingProgress.findById(progressDoc._id);
  res.status(200).json(updatedDoc);
}));

router.get("/:bookId", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;
  console.log(`[Progress GET] userId=${userId}, bookId=${bookId}`);
  
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const progressDoc = await ReadingProgress.findOne({ userId, bookId });
  
  console.log(`[Progress GET] Found progress:`, {
    id: progressDoc?._id,
    progress: progressDoc?.progress,
    status: progressDoc?.status
  });

  if (!progressDoc) {
    console.log(`[Progress GET] No progress found, returning defaults`);
    return res.status(200).json({
      progress: 0,
      status: "not-started",
      sessions: [],
      bookmarks: [],
      lastRead: null,
    });
  }

  res.status(200).json(progressDoc);
}));

export default router;
