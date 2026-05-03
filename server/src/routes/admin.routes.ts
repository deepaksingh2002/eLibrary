import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { Book } from "../models/Book";
import { User } from "../models/User";
import { UserActivity } from "../models/UserActivity";
import { Review } from "../models/Review";
import { computeRecommendations } from "../services/recommendationEngine";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { isValidObjectId, paginationParams } from "../utils/validate";

const router = Router();

type AdminBookSortKey = "downloads" | "rating" | "reviews";
type AdminListSortKey = "newest" | "downloads" | "rating";
type AdminUserSortKey = "newest" | "active" | "streak";

router.use(protect);
router.use(requireRole("admin"));

function firstDayOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/stats/kpis", asyncHandler(async (req, res) => {
  const [
    totalBooks,
    publishedBooks,
    totalUsers,
    newUsersThisMonth,
    totalDownloadsAgg,
    downloadsThisMonth,
    avgRatingAgg,
    totalReviews
  ] = await Promise.all([
    Book.countDocuments({ isDeleted: false }),
    Book.countDocuments({ status: "published", isDeleted: false }),
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({
      isDeleted: false,
      createdAt: { $gte: firstDayOfCurrentMonth() }
    }),
    Book.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$downloads" } } }
    ]),
    UserActivity.countDocuments({
      eventType: "download",
      createdAt: { $gte: firstDayOfCurrentMonth() }
    }),
    Book.aggregate([
      { $match: { status: "published", isDeleted: false, totalReviews: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$avgRating" } } }
    ]),
    Review.countDocuments({ isRemoved: false })
  ]);

  res.status(200).json({
    totalBooks,
    publishedBooks,
    totalUsers,
    newUsersThisMonth,
    totalDownloads: totalDownloadsAgg[0]?.total || 0,
    downloadsThisMonth,
    averageRating: parseFloat((avgRatingAgg[0]?.avg || 0).toFixed(1)),
    totalReviews
  });
}));

router.get("/stats/downloads-trend", asyncHandler(async (req, res) => {
  const period = (req.query.period as string) || "30d";
  
  let daysBack = 30;
  if (period === "7d") daysBack = 7;
  if (period === "90d") daysBack = 90;
  if (period === "12m") daysBack = 365;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const isMonthly = period === "12m";

  const groupStage = isMonthly 
    ? {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      }
    : {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" }
      };

  const aggResult = await UserActivity.aggregate([
    {
      $match: {
        eventType: "download",
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: groupStage,
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const trendMap = new Map<string, number>();
  for (const item of aggResult) {
    let key = "";
    const y = item._id.year;
    const m = String(item._id.month).padStart(2, "0");
    if (isMonthly) {
      key = `${y}-${m}-01`;
    } else {
      const d = String(item._id.day).padStart(2, "0");
      key = `${y}-${m}-${d}`;
    }
    trendMap.set(key, item.count);
  }

  const trend: { date: string; count: number }[] = [];
  const currentDate = new Date(startDate);
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  if (isMonthly) {
    currentDate.setDate(1);
    while (currentDate <= endDate || (currentDate.getFullYear() === endDate.getFullYear() && currentDate.getMonth() === endDate.getMonth())) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}-01`;
      trend.push({ date: key, count: trendMap.get(key) || 0 });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else {
    while (currentDate <= endDate) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, "0");
      const d = String(currentDate.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      trend.push({ date: key, count: trendMap.get(key) || 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  res.status(200).json({ trend, period });
}));

router.get("/stats/top-books", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const metric = req.query.metric as AdminBookSortKey | undefined;

  const sortField: Record<AdminBookSortKey, Record<string, 1 | -1>> = {
    downloads: { downloads: -1 },
    rating: { avgRating: -1, totalReviews: -1 },
    reviews: { totalReviews: -1 }
  };

  const books = await Book.find({ status: "published", isDeleted: false })
    .sort(sortField[metric ?? "downloads"])
    .limit(limit)
    .select("title author genre coverUrl downloads avgRating totalReviews createdAt");

  res.status(200).json({ books, metric: metric || "downloads" });
}));

router.get("/stats/genre-distribution", asyncHandler(async (req, res) => {
  const distribution = await Book.aggregate([
    { $match: { status: "published", isDeleted: false } },
    {
      $group: {
        _id: "$genre",
        count: { $sum: 1 },
        totalDownloads: { $sum: "$downloads" },
        avgRating: { $avg: "$avgRating" }
      }
    },
    { $sort: { count: -1 } },
    {
      $project: {
        genre: "$_id",
        count: 1,
        totalDownloads: 1,
        avgRating: { $round: ["$avgRating", 1] },
        _id: 0
      }
    }
  ]);

  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  res.status(200).json({ distribution, total });
}));

router.get("/stats/user-growth", asyncHandler(async (req, res) => {
  const period = (req.query.period as string) || "12m";
  let daysBack = period === "30d" ? 30 : 365;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const isMonthly = period === "12m";

  const groupStage = isMonthly
    ? {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      }
    : {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" }
      };

  const aggResult = await User.aggregate([
    { $match: { isDeleted: false, createdAt: { $gte: startDate } } },
    { $group: { _id: groupStage, count: { $sum: 1 } } },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const growthMap = new Map<string, number>();
  for (const item of aggResult) {
    let key = "";
    const y = item._id.year;
    const m = String(item._id.month).padStart(2, "0");
    if (isMonthly) {
      key = `${y}-${m}-01`;
    } else {
      const d = String(item._id.day).padStart(2, "0");
      key = `${y}-${m}-${d}`;
    }
    growthMap.set(key, item.count);
  }

  const usersBeforePeriod = await User.countDocuments({
    isDeleted: false,
    createdAt: { $lt: startDate }
  });

  const growth: { date: string; newUsers: number; cumulativeUsers: number }[] = [];
  const currentDate = new Date(startDate);
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  let cumulativeUsers = usersBeforePeriod;

  if (isMonthly) {
    currentDate.setDate(1);
    while (currentDate <= endDate || (currentDate.getFullYear() === endDate.getFullYear() && currentDate.getMonth() === endDate.getMonth())) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}-01`;
      const newUsers = growthMap.get(key) || 0;
      cumulativeUsers += newUsers;
      growth.push({ date: key, newUsers, cumulativeUsers });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else {
    while (currentDate <= endDate) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, "0");
      const d = String(currentDate.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      const newUsers = growthMap.get(key) || 0;
      cumulativeUsers += newUsers;
      growth.push({ date: key, newUsers, cumulativeUsers });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  res.status(200).json({ growth, period });
}));

router.get("/stats/activity-breakdown", asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const aggResult = await UserActivity.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: "$eventType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const eventTypes = ["view", "download", "rate", "bookmark", "complete", "progress"];
  const breakdownMap = new Map<string, number>();
  for (const item of aggResult) {
    breakdownMap.set(item._id, item.count);
  }

  const breakdown = eventTypes.map(type => ({
    eventType: type,
    count: breakdownMap.get(type) || 0
  })).sort((a, b) => b.count - a.count);

  res.status(200).json({ breakdown, period: "30d" });
}));

router.get("/books", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams({ ...req.query, limit: req.query.limit ?? "10" });

  const filter: Record<string, unknown> = { isDeleted: false };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.genre) filter.genre = req.query.genre;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const sortOptions: Record<AdminListSortKey, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    downloads: { downloads: -1 },
    rating: { avgRating: -1 },
  };
  const sort = sortOptions[(req.query.sort as AdminListSortKey) ?? "newest"] ?? sortOptions.newest;

  const [books, total] = await Promise.all([
    Book.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "name email"),
    Book.countDocuments(filter)
  ]);

  res.status(200).json({
    books,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
}));

router.patch("/books/:id/toggle-status", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid book id");
  const book = await Book.findOne({ _id: req.params.id, isDeleted: false });
  if (!book) throw new ApiError(404, "Book not found");

  book.status = book.status === "published" ? "draft" : "published";
  await book.save();

  res.status(200).json(book);
}));

router.post("/books/bulk-import", asyncHandler(async (req, res) => {
  const books = req.body.books;
  if (!Array.isArray(books)) throw new ApiError(400, "books must be an array");
  if (books.length > 100) throw new ApiError(400, "Maximum 100 items per import");

  const validBooks: Array<{ title?: string } & Record<string, unknown>> = [];
  const errors: Array<{ index: number; title: string; reason: string }> = [];

  for (let i = 0; i < books.length; i++) {
    const item = books[i];
    if (!item.title || !item.author || !item.genre || !item.pdfUrl) {
      errors.push({ index: i, title: item.title || "Unknown", reason: "Missing required fields" });
      continue;
    }

    validBooks.push({
      ...item,
      language: item.language || "en",
      status: item.status || "draft",
      uploadedBy: req.user!.id
    });
  }

  let imported = 0;
  if (validBooks.length > 0) {
    try {
      const result = await Book.insertMany(validBooks, { ordered: false });
      imported = result.length;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "insertedDocs" in error &&
        Array.isArray(error.insertedDocs)
      ) {
        imported = error.insertedDocs.length;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "writeErrors" in error &&
        Array.isArray(error.writeErrors)
      ) {
        for (const writeError of error.writeErrors as Array<{ index: number; errmsg: string }>) {
          const failedBook = validBooks[writeError.index];
          errors.push({
            index: writeError.index,
            title: typeof failedBook?.title === "string" ? failedBook.title : "Unknown",
            reason: writeError.errmsg
          });
        }
      }
    }
  }

  res.status(200).json({
    imported,
    failed: errors.length,
    errors
  });
}));

router.get("/export/books", asyncHandler(async (req, res) => {
  const format = req.query.format as string || "csv";
  const books = await Book.find({ isDeleted: false })
    .select("title author genre language downloads avgRating totalReviews status createdAt")
    .lean();

  if (format === "json") {
    return res.status(200).json(books);
  }

  const csvRows = [
    ["title", "author", "genre", "language", "downloads", "avgRating", "totalReviews", "status", "createdAt"].join(",")
  ];

  for (const b of books) {
    const row = [
      `"${(b.title || "").replace(/"/g, '""')}"`,
      `"${(b.author || "").replace(/"/g, '""')}"`,
      `"${(b.genre || "").replace(/"/g, '""')}"`,
      `"${(b.language || "").replace(/"/g, '""')}"`,
      b.downloads,
      b.avgRating,
      b.totalReviews,
      b.status,
      b.createdAt ? new Date(b.createdAt).toISOString() : ""
    ];
    csvRows.push(row.join(","));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="elibrary-books-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200).send(csvRows.join("\n"));
}));

router.get("/export/users", asyncHandler(async (req, res) => {
  const format = req.query.format as string || "csv";
  const users = await User.find({ isDeleted: false })
    .select("name email role totalBooksRead streak monthlyGoal createdAt")
    .lean();

  if (format === "json") {
    return res.status(200).json(users);
  }

  const csvRows = [
    ["name", "email", "role", "totalBooksRead", "streak", "monthlyGoal", "createdAt"].join(",")
  ];

  for (const u of users) {
    const row = [
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      u.role,
      u.totalBooksRead,
      u.streak,
      u.monthlyGoal,
      u.createdAt ? new Date(u.createdAt).toISOString() : ""
    ];
    csvRows.push(row.join(","));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="elibrary-users-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200).send(csvRows.join("\n"));
}));

router.post("/stats/trigger-recommendations", asyncHandler(async (req, res) => {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    throw new ApiError(401, "Invalid cron secret");
  }

  const start = Date.now();
  await computeRecommendations();
  res.status(200).json({ message: "Recommendations computed", duration: Date.now() - start });
}));

router.get("/users", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams({ ...req.query, limit: req.query.limit ?? "10" });

  const filter: Record<string, unknown> = { isDeleted: false };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } }
    ];
  }

  const sortMap: Record<AdminUserSortKey, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    active: { lastActiveDate: -1 },
    streak: { streak: -1 }
  };
  const sort = sortMap[(req.query.sort as AdminUserSortKey) ?? "newest"] ?? sortMap.newest;

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select("name email role avatar streak totalBooksRead monthlyGoal createdAt lastActiveDate isDeleted"),
    User.countDocuments(filter)
  ]);

  res.status(200).json({
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
}));

router.patch("/users/:userId/role", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.userId)) throw new ApiError(400, "Invalid user id");
  const { role } = req.body;
  if (!["admin", "user", "guest"].includes(role)) {
    throw new ApiError(400, "Role must be one of admin, user, guest");
  }

  if (req.params.userId === req.user!.id) {
    throw new ApiError(400, "Cannot change your own role");
  }

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { role },
    { new: true }
  ).select("name email role");

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(user);
}));

router.delete("/users/:userId", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.userId)) throw new ApiError(400, "Invalid user id");
  if (req.params.userId === req.user!.id) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    {
      isDeleted: true,
      refreshTokens: [],
      passwordResetToken: undefined,
      email: `deleted_${req.params.userId}@deleted.com`
    },
    { new: true }
  );

  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json({ message: "User account deactivated" });
}));

router.get("/users/:userId/activity", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.userId)) throw new ApiError(400, "Invalid user id");
  const { page, limit, skip } = paginationParams({ ...req.query, limit: req.query.limit ?? "20" });

  const [activities, total] = await Promise.all([
    UserActivity.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("bookId", "title author coverUrl"),
    UserActivity.countDocuments({ userId: req.params.userId })
  ]);

  res.status(200).json({
    activities,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
}));

export default router;
