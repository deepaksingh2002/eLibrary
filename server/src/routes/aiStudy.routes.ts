import { Router } from "express"
import { Types } from "mongoose"
import { protect } from "../middleware/auth.middleware"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/ApiError"
import { normalizeExtractionStatus } from "../utils/bookAiStatus"
import Book from "../models/Book"
import AIStudyCache from "../models/AIStudyCache"
import {
  generateBookSummary,
  generateMCQQuestions,
  generateKeyPoints,
  getBookChapterIndex,
} from "../services/aiStudyService"

const router = Router()
router.use(protect)

const getParamValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value)

async function getCached(
  bookId: string,
  type: "summary" | "mcq" | "keypoints",
) {
  const cached = await AIStudyCache.findOne({
    bookId: new Types.ObjectId(bookId),
    type,
    expiresAt: { $gt: new Date() },
  }).lean()

  if (!cached) {
    return null
  }

  if (type === "summary" && !cached.data?.basedOnPDF) {
    return null
  }

  if (type === "mcq" && !Array.isArray(cached.data) && !Array.isArray(cached.data?.questions)) {
    return null
  }

  if (type === "mcq") {
    const questions = Array.isArray(cached.data) ? cached.data : cached.data?.questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return null
    }
  }

  if (type === "keypoints" && !cached.data?.basedOnPDF) {
    return null
  }

  return cached
}

async function saveCache(
  bookId: string,
  type: "summary" | "mcq" | "keypoints",
  data: any,
) {
  const filter = { bookId: new Types.ObjectId(bookId), type }
  const update = {
    $set: {
      data,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  }

  try {
    await AIStudyCache.findOneAndUpdate(filter, update, { upsert: true })
  } catch (error: any) {
    if (error?.code === 11000) {
      await AIStudyCache.updateOne(filter, update)
      return
    }

    throw error
  }
}

function respondWithSummary(
  res: import("express").Response,
  summary: Awaited<ReturnType<typeof generateBookSummary>>,
  cached: boolean,
) {
  if (!summary.basedOnPDF) {
    return res.status(503).json({
      summary,
      cached,
      basedOnPDF: false,
      error: "AI summary generation is unavailable until the PDF is indexed.",
    })
  }

  return res.status(200).json({
    summary,
    cached,
    basedOnPDF: true,
  })
}

function respondWithKeyPoints(
  res: import("express").Response,
  keyPoints: Awaited<ReturnType<typeof generateKeyPoints>>,
  cached: boolean,
) {
  if (!keyPoints.basedOnPDF) {
    return res.status(503).json({
      keyPoints,
      cached,
      basedOnPDF: false,
      error: "AI key point generation is unavailable until the PDF is indexed.",
    })
  }

  return res.status(200).json({
    keyPoints,
    cached,
    basedOnPDF: true,
  })
}

function respondWithMcq(
  res: import("express").Response,
  questions: Awaited<ReturnType<typeof generateMCQQuestions>>["questions"],
  cached: boolean,
  fallbackUsed: boolean,
  errorMessage: string,
) {
  if (questions.length === 0) {
    return res.status(200).json({
      questions,
      total: 0,
      cached,
      basedOnPDF: false,
      fallbackUsed: false,
      error: errorMessage,
    })
  }

  return res.status(200).json({
    questions,
    total: questions.length,
    cached,
    basedOnPDF: true,
    fallbackUsed,
  })
}

async function getBook(bookId: string) {
  const book = await Book.findOne({
    _id: bookId,
    isDeleted: false,
  })
    .select("title author genre description tags pdfUrl extractionStatus extractionError extractedAt")
    .lean()

  if (!book) {
    throw new ApiError(404, "Book not found")
  }

  return book as any
}

router.get(
  "/:bookId/status",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const book = await Book.findById(bookId)
      .select("title pdfUrl extractionStatus extractionError extractedAt pdfTextExtracted")
      .lean()

    if (!book) {
      throw new ApiError(404, "Book not found")
    }

    const extractionStatus = normalizeExtractionStatus(book as {
      extractionStatus?: string
      pdfUrl?: string
      pdfTextExtracted?: boolean
      extractedAt?: Date | string | null
      extractionError?: string | null
    })

    if (
      (book as any).extractionStatus === "processing" &&
      extractionStatus === "ready" &&
      ((book as any).pdfTextExtracted === true || !!(book as any).extractedAt)
    ) {
      await Book.findByIdAndUpdate(bookId, {
        extractionStatus: "ready",
        extractionError: "",
        pdfTextExtracted: true,
      })
    }

    res.json({
      title: (book as any).title,
      extractionStatus,
      isReady: extractionStatus === "ready",
      hasPdf: !!(book as any).pdfUrl,
      error: (book as any).extractionError || null,
      extractedAt: (book as any).extractedAt || null,
    })
  }),
)

router.get(
  "/:bookId/summary",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    const forceFresh = getParamValue(req.query.fresh as string | string[] | undefined) !== undefined
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = forceFresh ? null : await getCached(bookId, "summary")
    if (cached) {
      return res.json({
        summary: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating summary:", book.title)

    const summary = await generateBookSummary(book as any)
    if (summary.basedOnPDF) {
      await saveCache(bookId, "summary", summary)
    }

    return respondWithSummary(res, summary, false)
  }),
)

router.get(
  "/:bookId/chapter-index",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating chapter index:", book.title)

    const chapterIndex = await getBookChapterIndex(book as any)

    if (!chapterIndex.basedOnPDF || chapterIndex.chapters.length === 0) {
      return res.status(503).json({
        chapterIndex,
        basedOnPDF: false,
        error: "Could not detect a chapter index from the PDF contents.",
      })
    }

    return res.status(200).json({
      chapterIndex,
      basedOnPDF: true,
    })
  }),
)

router.get(
  "/:bookId/mcq",
  asyncHandler(async (req, res) => {
      const bookId = getParamValue(req.params.bookId)
      const rawCount = getParamValue(req.query.count as string | string[] | undefined)
      let count = 10
      if (rawCount !== undefined) {
        const parsed = Number.parseInt(rawCount, 10)
        if (Number.isNaN(parsed)) {
          throw new ApiError(400, "count must be a number between 5 and 20")
        }
        if (parsed < 5 || parsed > 20) {
          throw new ApiError(400, "count must be between 5 and 20")
        }
        count = parsed
      }
      const chapterFocus = getParamValue(req.query.chapter as string | string[] | undefined)
    const forceFresh = getParamValue(req.query.fresh as string | string[] | undefined) !== undefined
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = !forceFresh && !chapterFocus ? await getCached(bookId, "mcq") : null
    if (cached) {
      return res.json({
        questions: cached.data,
        total: Array.isArray(cached.data) ? cached.data.length : 0,
        cached: true,
        basedOnPDF: true,
        fallbackUsed: false,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating MCQ:", book.title)

    const mcqResult = await generateMCQQuestions(book as any, count, chapterFocus)
    const questions = mcqResult.questions
    if (questions.length > 0 && !chapterFocus && !mcqResult.fallbackUsed) {
      await saveCache(bookId, "mcq", questions)
    }

    return respondWithMcq(
      res,
      questions,
      false,
      mcqResult.fallbackUsed,
      "Could not generate quiz questions from the PDF content.",
    )
  }),
)

router.get(
  "/:bookId/key-points",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    const forceFresh = getParamValue(req.query.fresh as string | string[] | undefined) !== undefined
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = forceFresh ? null : await getCached(bookId, "keypoints")
    if (cached) {
      return res.json({
        keyPoints: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating key points:", book.title)

    const keyPoints = await generateKeyPoints(book as any)
    if (keyPoints.basedOnPDF) {
      await saveCache(bookId, "keypoints", keyPoints)
    }

    return respondWithKeyPoints(res, keyPoints, false)
  }),
)

router.delete(
  "/:bookId/cache",
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "admin") {
      throw new ApiError(403, "Admin only")
    }

    const bookId = getParamValue(req.params.bookId)
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    await AIStudyCache.deleteMany({
      bookId: new Types.ObjectId(bookId),
    })

    res.json({ message: "Cache cleared. Next request regenerates from PDF." })
  }),
)

export default router
