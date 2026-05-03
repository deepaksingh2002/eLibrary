import { Router } from "express";
import { Types } from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { Recommendation } from "../models/Recommendation";
import { Book } from "../models/Book";
import { UserActivity } from "../models/UserActivity";
import { computeColdStartForUser, getSimilarBooks } from "../services/recommendationEngine";
import { explainRecommendation, isGeminiAvailable } from "../services/claudeService";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

const router = Router();

router.get("/", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  let rec = await Recommendation.findOne({ userId })
    .populate("books.bookId", "title author coverUrl genre avgRating totalReviews downloads tags")
    .lean();

  if (!rec) {
    console.log("[Recommendations] No recommendations for user:", userId, "- computing cold start");
    await computeColdStartForUser(userId);
    rec = await Recommendation.findOne({ userId })
      .populate("books.bookId", "title author coverUrl genre avgRating totalReviews downloads tags")
      .lean();
  }

  const recommendations = (rec?.books || [])
    .filter((b) => b.bookId != null)
    .map((b) => ({
      book: b.bookId,
      score: b.score,
      reason: b.reason
    }));

  res.status(200).json({
    recommendations,
    isColdStart: rec?.isColdStart ?? true,
    computedAt: rec?.computedAt ?? null,
    total: recommendations.length
  });
}));

router.get("/similar/:bookId", asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!Types.ObjectId.isValid(bookId)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const similar = await getSimilarBooks(bookId, 6);

  const populated = await Promise.all(
    similar.map(async (item) => {
      const book = await Book.findById(item.bookId)
        .select("title author coverUrl genre avgRating")
        .lean();
      return { book, score: item.score };
    })
  );

  res.status(200).json({ similar: populated.filter((item) => item.book !== null) });
}));

router.get("/:bookId/explain", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;

  if (!Types.ObjectId.isValid(bookId)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const targetBook = await Book.findOne({ _id: bookId, isDeleted: false })
    .select("title author genre tags")
    .lean();

  if (!targetBook) throw new ApiError(404, "Book not found");

  const recentActivity = await UserActivity.find({
    userId,
    eventType: { $in: ["rate", "complete", "download"] }
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("bookId", "title author genre")
    .lean();

  const likedBooks = recentActivity
    .filter((activity) => activity.bookId && (activity.bookId as any).title)
    .map((activity) => ({
      title: (activity.bookId as any).title,
      author: (activity.bookId as any).author,
      genre: (activity.bookId as any).genre
    }));

  const explanation = await explainRecommendation({
    targetBook: {
      title: targetBook.title,
      author: targetBook.author,
      genre: targetBook.genre,
      tags: targetBook.tags || []
    },
    likedBooks: likedBooks.slice(0, 5),
    userName: userId
  });

  const aiGenerated = await isGeminiAvailable();

  res.status(200).json({ 
    explanation, 
    isAIGenerated: aiGenerated,
    provider: "gemini" 
  });
}));

router.post("/refresh", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const rec = await Recommendation.findOne({ userId }).lean();
  
  if (rec && rec.computedAt && (Date.now() - rec.computedAt.getTime()) < 3600000) {
    return res.status(429).json({
      message: "Recommendations refreshed recently. Try again later.",
      nextRefreshAt: new Date(rec.computedAt.getTime() + 3600000)
    });
  }

  await computeColdStartForUser(userId);
  
  res.status(200).json({ message: "Recommendations refreshed", computedAt: new Date() });
}));

export default router;
