import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { Recommendation } from "../models/Recommendation";
import { Book } from "../models/Book";
import { UserActivity } from "../models/UserActivity";
import { User } from "../models/User";
import { computeColdStartForUser, getSimilarBooks } from "../services/recommendationEngine";
import { explainRecommendation, isGeminiAvailable } from "../services/claudeService";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { isValidObjectId } from "../utils/validate";

const router = Router();

interface ActivityBookSummary {
  title: string;
  author: string;
  genre: string;
}

router.get("/", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  let rec = await Recommendation.findOne({ userId })
    .populate("books.bookId", "title author coverUrl genre avgRating totalReviews downloads tags");

  if (!rec) {
    await computeColdStartForUser(userId);
    rec = await Recommendation.findOne({ userId })
      .populate("books.bookId", "title author coverUrl genre avgRating totalReviews downloads tags");
  }

  if (!rec) {
    throw new ApiError(500, "Failed to fetch recommendations");
  }

  const validBooks = rec.books
    .filter((b) => b.bookId != null)
    .map((b) => ({
      book: b.bookId,
      score: b.score,
      reason: b.reason
    }));

  res.status(200).json({
    recommendations: validBooks,
    isColdStart: rec.isColdStart,
    computedAt: rec.computedAt,
    total: validBooks.length
  });
}));

router.get("/:bookId/explain", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { bookId } = req.params;
  
  console.log(`[Recommendations] Explaining recommendation for book ${bookId} user ${userId}`);
  
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const targetBook = await Book.findById(bookId).select("title author genre tags").lean();
  if (!targetBook) throw new ApiError(404, "Book not found");

  const recentActivity = await UserActivity.find({
    userId,
    eventType: { $in: ["rate", "complete", "download"] }
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("bookId", "title author genre")
    .lean();

  let likedActivities = recentActivity.filter((a) => a.eventType === "rate" && a.rating && a.rating >= 4);
  if (likedActivities.length === 0) {
    likedActivities = recentActivity;
  }

  const likedBooks = likedActivities
    .map((activity) => activity.bookId as unknown as ActivityBookSummary | null)
    .filter((book): book is ActivityBookSummary => book != null)
    .slice(0, 5)
    .map((book) => ({
      title: book.title,
      author: book.author,
      genre: book.genre
    }));

  console.log(`[Recommendations] Found ${likedBooks.length} liked books for context`);

  const user = await User.findById(userId).select("name").lean();

  const explanation = await explainRecommendation({
    targetBook: {
      title: targetBook.title,
      author: targetBook.author,
      genre: targetBook.genre,
      tags: targetBook.tags || []
    },
    likedBooks,
    userName: user?.name
  });

  const isAI = await isGeminiAvailable();
  console.log(`[Recommendations] Explanation generated, isAI: ${isAI}`);

  res.status(200).json({ 
    explanation, 
    isAIGenerated: isAI,
    provider: "gemini" 
  });
}));

router.get("/similar/:bookId", asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const similar = await getSimilarBooks(bookId, 6);
  
  const populated = await Promise.all(
    similar.map(async (item) => {
      const book = await Book.findById(item.bookId)
        .select("title author coverUrl genre avgRating totalReviews")
        .lean();
      return { book, score: item.score };
    })
  );

  const validSimilar = populated.filter((item) => item.book != null);

  res.status(200).json({ similar: validSimilar });
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
