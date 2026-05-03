import { Router } from "express";
import { SortOrder, Types } from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { logActivity } from "../middleware/activityLogger";
import { requireRole } from "../middleware/rbac.middleware";
import { Book } from "../models/Book";
import { Review } from "../models/Review";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { isValidObjectId, paginationParams, sanitizeString } from "../utils/validate";

const router = Router();

function validateReviewTextField(
  value: unknown,
  fieldName: string,
  maxLength: number
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldName} must be a string`);
  }

  const sanitized = sanitizeString(value);
  if (sanitized.length > maxLength) {
    throw new ApiError(400, `${fieldName} must be ${maxLength} characters or fewer`);
  }

  return sanitized;
}

function validateReviewRating(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw new ApiError(400, "Rating must be an integer between 1 and 5");
  }

  return Number(value);
}

async function recalculateBookRating(bookId: string): Promise<void> {
  const result = await Review.aggregate([
    { $match: { bookId: new Types.ObjectId(bookId), isRemoved: false } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  if (result.length > 0) {
    await Book.findByIdAndUpdate(bookId, {
      avgRating: parseFloat(result[0].avgRating.toFixed(1)),
      totalReviews: result[0].count,
    }, { new: true });
    return;
  }

  await Book.findByIdAndUpdate(bookId, { avgRating: 0, totalReviews: 0 }, { new: true });
}

router.get("/my", protect, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const reviews = await Review.find({ userId, isRemoved: false })
    .populate("bookId", "title coverUrl author")
    .sort({ createdAt: -1 });

  res.status(200).json(reviews);
}));

router.get("/flagged", protect, requireRole("admin"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { isFlagged: true, isRemoved: false };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("userId", "name email")
      .populate("bookId", "title author")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}));

router.get("/book/:bookId", asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const { page, limit, skip } = paginationParams(req.query);
  const sort = (req.query.sort as string) || "helpful";

  const sortMap: Record<string, Record<string, SortOrder>> = {
    helpful: { helpfulVotes: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
  };

  const filter = { bookId: new Types.ObjectId(bookId), isRemoved: false };
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate("userId", "name avatar")
      .sort(sortMap[sort] ?? sortMap.helpful)
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  res.status(200).json({
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}));

router.get("/book/:bookId/distribution", asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!isValidObjectId(bookId)) throw new ApiError(400, "Invalid book id");

  const raw = await Review.aggregate([
    { $match: { bookId: new Types.ObjectId(bookId), isRemoved: false } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const countMap: Record<number, number> = {};
  raw.forEach((item) => {
    countMap[item._id] = item.count;
  });

  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: countMap[star] ?? 0,
  }));

  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  const weightedSum = distribution.reduce((sum, item) => sum + item.star * item.count, 0);
  const average = total > 0 ? parseFloat((weightedSum / total).toFixed(1)) : 0;

  res.status(200).json({ distribution, total, average });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  const { bookId, rating, title, body } = req.body;

  if (!bookId || !isValidObjectId(bookId)) {
    throw new ApiError(400, "Valid bookId is required");
  }
  if (rating === undefined) {
    throw new ApiError(400, "Rating must be an integer between 1 and 5");
  }

  const safeRating = validateReviewRating(rating);
  const safeTitle = validateReviewTextField(title, "Review title", 120);
  const safeBody = validateReviewTextField(body, "Review body", 2000);

  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new ApiError(404, "Book not found");

  const userId = req.user!.id;
  const existing = await Review.findOne({ bookId, userId });
  if (existing) throw new ApiError(409, "You have already reviewed this book");

  const review = await Review.create({
    bookId,
    userId,
    rating: safeRating,
    title: safeTitle ?? "",
    body: safeBody ?? "",
  });

  await recalculateBookRating(bookId);

  logActivity({
    userId,
    bookId,
    eventType: "rate",
    rating: safeRating,
  });

  const populated = await review.populate("userId", "name avatar");
  res.status(201).json(populated);
}));

router.patch("/:reviewId", protect, asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidObjectId(reviewId)) throw new ApiError(400, "Invalid review id");

  const review = await Review.findById(reviewId);
  if (!review || review.isRemoved) throw new ApiError(404, "Review not found");
  if (review.userId.toString() !== req.user!.id) {
    throw new ApiError(403, "You are not allowed to edit this review");
  }

  const { title, body, rating } = req.body;
  const safeTitle = validateReviewTextField(title, "Review title", 120);
  const safeBody = validateReviewTextField(body, "Review body", 2000);
  const safeRating = rating !== undefined ? validateReviewRating(rating) : undefined;
  const ratingChanged = safeRating !== undefined && safeRating !== review.rating;

  if (safeTitle !== undefined) review.title = safeTitle;
  if (safeBody !== undefined) review.body = safeBody;
  if (safeRating !== undefined) review.rating = safeRating;

  await review.save();

  if (ratingChanged) {
    await recalculateBookRating(review.bookId.toString());
  }

  res.status(200).json(review);
}));

router.delete("/:reviewId", protect, asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidObjectId(reviewId)) throw new ApiError(400, "Invalid review id");

  const review = await Review.findById(reviewId);
  if (!review || review.isRemoved) throw new ApiError(404, "Review not found");

  const isOwner = review.userId.toString() === req.user!.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Not allowed to delete this review");
  }

  const bookId = review.bookId.toString();

  if (isOwner && !isAdmin) {
    await Review.findByIdAndDelete(reviewId);
  } else {
    review.isRemoved = true;
    review.isFlagged = false;
    await review.save();
  }

  await recalculateBookRating(bookId);
  res.status(200).json({ message: "Review deleted" });
}));

router.post("/:reviewId/helpful", protect, asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidObjectId(reviewId)) throw new ApiError(400, "Invalid review id");

  const userId = new Types.ObjectId(req.user!.id);

  const votedReview = await Review.findOneAndUpdate(
    { _id: reviewId, isRemoved: false, voters: { $ne: userId } },
    { $push: { voters: userId }, $inc: { helpfulVotes: 1 } },
    { new: true }
  );

  if (votedReview) {
    return res.status(200).json({
      voted: true,
      helpfulVotes: votedReview.helpfulVotes,
    });
  }

  const unvotedReview = await Review.findOneAndUpdate(
    { _id: reviewId, isRemoved: false, voters: userId },
    { $pull: { voters: userId }, $inc: { helpfulVotes: -1 } },
    { new: true }
  );

  if (unvotedReview) {
    return res.status(200).json({
      voted: false,
      helpfulVotes: unvotedReview.helpfulVotes,
    });
  }

  throw new ApiError(404, "Review not found");
}));

router.patch("/:reviewId/flag", protect, requireRole("admin"), asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!isValidObjectId(reviewId)) throw new ApiError(400, "Invalid review id");

  const { action } = req.body as { action: "flag" | "unflag" | "remove" };
  if (!["flag", "unflag", "remove"].includes(action)) {
    throw new ApiError(400, "Action must be 'flag', 'unflag', or 'remove'");
  }

  const review = await Review.findById(reviewId);
  if (!review || review.isRemoved) throw new ApiError(404, "Review not found");

  if (action === "flag") {
    review.isFlagged = true;
    await review.save();
    return res.status(200).json(review);
  }

  if (action === "unflag") {
    review.isFlagged = false;
    await review.save();
    return res.status(200).json(review);
  }

  review.isRemoved = true;
  review.isFlagged = false;
  await review.save();
  await recalculateBookRating(review.bookId.toString());

  res.status(200).json(review);
}));

export default router;
