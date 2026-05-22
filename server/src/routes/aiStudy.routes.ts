import { Router } from "express";
import { Types } from "mongoose";
import { protect } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import Book from "../models/Book";
import AIStudyCache from "../models/AIStudyCache";
import {
  generateBookSummary,
  generateMCQQuestions,
  generateKeyPoints,
  generateFlashcards,
} from "../services/aiStudyService";
import { isFileURIValid } from "../services/geminiPDFService";
import { normalizeExtractionStatus } from "../utils/bookAiStatus";

const router = Router();
router.use(protect);

const getParamValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

// ─── Helper: get book data needed for AI ─────────────────
async function getBook(bookId: string) {
  const book = await Book.findOne({
    _id: bookId,
    isDeleted: false,
  })
    .select(
      "title author genre description tags " +
        "pdfUrl geminiFileUri geminiMimeType " +
        "extractionStatus extractionError",
    )
    .lean();

  if (!book) throw new ApiError(404, "Book not found");
  return book;
}

// ─── Helper: get cached result ────────────────────────────
async function getCached(
  bookId: string,
  type: "summary" | "mcq" | "keypoints" | "flashcards",
) {
  return AIStudyCache.findOne({
    bookId: new Types.ObjectId(bookId),
    type,
    expiresAt: { $gt: new Date() },
  } as any).lean();
}

// ─── Helper: save to cache ────────────────────────────────
async function saveCache(
  bookId: string,
  type: "summary" | "mcq" | "keypoints" | "flashcards",
  data: any,
) {
  try {
    await AIStudyCache.findOneAndUpdate(
      ({
        bookId: new Types.ObjectId(bookId),
        type,
      } as any),
      {
        $set: {
          data,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      } as any,
      { upsert: true },
    );
  } catch (err: any) {
    // Ignore duplicate key race-condition (two concurrent upserts)
    if (err && typeof err.code === "number" && err.code === 11000) {
      console.warn(`[AIStudy] saveCache duplicate key for ${bookId} ${type}`);
      return;
    }
    console.error("[AIStudy] saveCache error:", err);
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/flashcards?count=8
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/flashcards",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId);
    const count = Math.min(20, Math.max(3, parseInt(req.query.count as string) || 8));
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const cached = await getCached(bookId, "flashcards");
    if (cached) {
      return res.json({
        flashcards: cached.data,
        total: Array.isArray(cached.data) ? cached.data.length : 0,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || true,
      });
    }

    const book = await getBook(bookId);
    console.log("[AIStudy] Generating flashcards:", (book as any).title);

    const flashcards = await generateFlashcards(book as any, count);
    await saveCache(bookId, "flashcards", flashcards);

    res.json({
      flashcards,
      total: flashcards.length,
      cached: false,
      basedOnPDF: true,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/status
// Check if book PDF is ready for AI processing
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/status",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findById(bookId)
      .select(
        "title pdfUrl extractionStatus extractionError " + "geminiFileUri extractedAt",
      )
      .lean();

    if (!book) throw new ApiError(404, "Book not found");

    const extractionStatus = normalizeExtractionStatus(book as {
      extractionStatus?: string;
      geminiFileUri?: string;
      pdfUrl?: string;
    });

    res.json({
      title: (book as any).title,
      extractionStatus,
      isReady: extractionStatus === "ready",
      hasFileUri: !!(book as any).geminiFileUri,
      error: (book as any).extractionError || null,
      extractedAt: (book as any).extractedAt || null,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/summary
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/summary",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    // Check cache first
    const cached = await getCached(bookId, "summary");
    if (cached) {
      return res.json({
        summary: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      });
    }

    const book = await getBook(bookId);
    console.log("[AIStudy] Generating summary:", (book as any).title);

    let summary = await generateBookSummary(book as any);

    // Safety guard: ensure we never send `null` back to the client.
    if (!summary) {
      console.error(
        `[AIStudy] generateBookSummary returned falsy for book ${bookId} (${(book as any).title})`,
      );
      summary = {
        overview: "Could not generate a summary for this book.",
        keyThemes: ["Summary generation failed"],
        targetReader: "Unavailable",
        difficulty: "Intermediate",
        estimatedTime: "Unknown",
        basedOnPDF: false,
      };
    }

    await saveCache(bookId, "summary", summary);

    res.json({
      summary,
      cached: false,
      basedOnPDF: summary.basedOnPDF || false,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/mcq?count=10
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/mcq",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId);
    const count = Math.min(
      20,
      Math.max(5, parseInt(req.query.count as string) || 10),
    );
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const cached = await getCached(bookId, "mcq");
    if (cached) {
      return res.json({
        questions: cached.data,
        total: cached.data?.length || 0,
        cached: true,
        basedOnPDF: true,
      });
    }

    const book = await getBook(bookId);
    console.log("[AIStudy] Generating MCQ:", (book as any).title);

    const questions = await generateMCQQuestions(book as any, count);
    await saveCache(bookId, "mcq", questions);

    res.json({
      questions,
      total: questions.length,
      cached: false,
      basedOnPDF: true,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/key-points
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/key-points",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const cached = await getCached(bookId, "keypoints");
    if (cached) {
      return res.json({
        keyPoints: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      });
    }

    const book = await getBook(bookId);
    console.log("[AIStudy] Generating key points:", (book as any).title);

    const keyPoints = await generateKeyPoints(book as any);
    await saveCache(bookId, "keypoints", keyPoints);

    res.json({
      keyPoints,
      cached: false,
      basedOnPDF: keyPoints.basedOnPDF,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// DELETE /api/ai-study/:bookId/cache   (Admin only)
// Clear cached results — forces fresh generation
// ─────────────────────────────────────────────────────────
router.delete(
  "/:bookId/cache",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin") {
      throw new ApiError(403, "Admin only");
    }
    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }
    await AIStudyCache.deleteMany({
      bookId: new Types.ObjectId(bookId),
    });
    res.json({
      message: "Cache cleared. Next request will re-read the PDF.",
    });
  }),
);

// ─────────────────────────────────────────────────────────
// POST /api/ai-study/:bookId/upload-to-gemini  (Admin only)
// Manually trigger Gemini upload for old books
// ─────────────────────────────────────────────────────────
router.post(
  "/:bookId/upload-to-gemini",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin") {
      throw new ApiError(403, "Admin only");
    }

    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findById(bookId).select("title pdfUrl").lean();

    if (!book) throw new ApiError(404, "Book not found");
    if (!(book as any).pdfUrl) {
      throw new ApiError(400, "No PDF URL for this book");
    }

    // Update status
    await Book.findByIdAndUpdate(bookId, {
      extractionStatus: "uploading",
      extractionError: "",
    });

    // Upload to Gemini
    const { reUploadFromURL } = await import("../services/geminiPDFService");

    const result = await reUploadFromURL(
      (book as any).pdfUrl,
      `${(book as any).title}.pdf`,
    );

    if (result.success) {
      await Book.findByIdAndUpdate(bookId, {
        geminiFileUri: result.fileUri,
        geminiMimeType: result.mimeType,
        extractionStatus: "ready",
        extractedAt: new Date(),
      });

      // Clear old cache so next request uses new file
      await AIStudyCache.deleteMany({
        bookId: new Types.ObjectId(bookId),
      });

      return res.json({
        message: "PDF uploaded to Gemini successfully. AI features are ready.",
        fileUri: result.fileUri,
        success: true,
      });
    }

    await Book.findByIdAndUpdate(bookId, {
      extractionStatus: "failed",
      extractionError: result.error || "Upload failed",
    });

    res.status(500).json({
      message: result.error || "Upload failed",
      success: false,
    });
  }),
);

// ─────────────────────────────────────────────────────────
// GET /api/ai-study/:bookId/debug  (Admin only)
// Return book PDF/Gemini fields and file validity for debugging
// ─────────────────────────────────────────────────────────
router.get(
  "/:bookId/debug",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin") {
      throw new ApiError(403, "Admin only");
    }

    const bookId = getParamValue(req.params.bookId);
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findById(bookId)
      .select(
        "title author pdfUrl geminiFileUri geminiMimeType extractionStatus extractionError extractedAt",
      )
      .lean();

    if (!book) throw new ApiError(404, "Book not found");

    const isValid = (book as any).geminiFileUri
      ? await isFileURIValid((book as any).geminiFileUri)
      : false;

    res.json({
      book,
      isFileUriValid: isValid,
    });
  }),
);

export default router;
