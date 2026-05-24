import { Router } from "express"
import { Types } from "mongoose"
import { protect } from "../middleware/auth.middleware"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/ApiError"
import { normalizeExtractionStatus } from "../utils/bookAiStatus"
import Book from "../models/Book"
import AIStudyCache from "../models/AIStudyCache"
import {
  loadBookPDF,
  generateSummary,
  generateMCQ,
  generateKeyPoints,
} from "../services/langchainPdfService"

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

async function getPDFText(book: any): Promise<{
  text: string
  pages: number
  success: boolean
  error?: string
}> {
  if (!book.pdfUrl) {
    return {
      text: "",
      pages: 0,
      success: false,
      error: "No PDF found for this book",
    }
  }

  return loadBookPDF(book.pdfUrl, book.title)
}

router.get(
  "/:bookId/status",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const book = await Book.findById(bookId)
      .select("title pdfUrl extractionStatus extractionError extractedAt")
      .lean()

    if (!book) {
      throw new ApiError(404, "Book not found")
    }

    const extractionStatus = normalizeExtractionStatus(book as {
      extractionStatus?: string
      pdfUrl?: string
    })

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
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCached(bookId, "summary")
    if (cached) {
      return res.json({
        summary: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating summary:", book.title)

    const pdf = await getPDFText(book)
    if (!pdf.success || !pdf.text) {
      return res.json({
        summary: {
          overview: pdf.error || "PDF could not be read",
          keyThemes: [],
          targetReader: "",
          difficulty: "Intermediate",
          estimatedTime: "",
          basedOnPDF: false,
        },
        cached: false,
        basedOnPDF: false,
        error: pdf.error,
      })
    }

    const summary = await generateSummary(pdf.text, book.title, book.author, book.genre)
    if (summary.basedOnPDF) {
      await saveCache(bookId, "summary", summary)
    }

    res.json({
      summary,
      cached: false,
      basedOnPDF: summary.basedOnPDF,
    })
  }),
)

router.get(
  "/:bookId/mcq",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    const count = Math.min(20, Math.max(5, parseInt(req.query.count as string) || 10))
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCached(bookId, "mcq")
    if (cached) {
      return res.json({
        questions: cached.data,
        total: Array.isArray(cached.data) ? cached.data.length : 0,
        cached: true,
        basedOnPDF: true,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating MCQ:", book.title)

    const pdf = await getPDFText(book)
    if (!pdf.success || !pdf.text) {
      return res.json({
        questions: [],
        total: 0,
        cached: false,
        basedOnPDF: false,
        error: pdf.error,
      })
    }

    const questions = await generateMCQ(pdf.text, book.title, count)
    if (questions.length > 0) {
      await saveCache(bookId, "mcq", questions)
    }

    res.json({
      questions,
      total: questions.length,
      cached: false,
      basedOnPDF: questions.length > 0,
      error: questions.length === 0 ? "Could not generate quiz questions from the PDF content." : undefined,
    })
  }),
)

router.get(
  "/:bookId/key-points",
  asyncHandler(async (req, res) => {
    const bookId = getParamValue(req.params.bookId)
    if (!bookId || !Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCached(bookId, "keypoints")
    if (cached) {
      return res.json({
        keyPoints: cached.data,
        cached: true,
        basedOnPDF: cached.data?.basedOnPDF || false,
      })
    }

    const book = await getBook(bookId)
    console.log("[AIStudy] Generating key points:", book.title)

    const pdf = await getPDFText(book)
    if (!pdf.success || !pdf.text) {
      return res.json({
        keyPoints: {
          chapters: [],
          glossary: [],
          takeaways: [],
          examTips: [],
          interviewTopics: [],
          basedOnPDF: false,
        },
        cached: false,
        basedOnPDF: false,
        error: pdf.error,
      })
    }

    const keyPoints = await generateKeyPoints(pdf.text, book.title, book.author, book.genre)
    if (keyPoints.basedOnPDF) {
      await saveCache(bookId, "keypoints", keyPoints)
    }

    res.json({
      keyPoints,
      cached: false,
      basedOnPDF: keyPoints.basedOnPDF,
    })
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
