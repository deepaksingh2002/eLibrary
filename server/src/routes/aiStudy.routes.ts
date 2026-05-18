import { Router } from "express"
import { Types } from "mongoose"
import { protect } from "../middleware/auth.middleware"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/ApiError"
import Book from "../models/Book"
import AIStudyCache from "../models/AIStudyCache"
import {
  generateBookSummary,
  generateMCQQuestions,
  generateKeyPoints
} from "../services/aiStudyService"

const router = Router()

router.use(protect)

async function getCache(bookId: string) {
  const now = new Date()
  const cache = await AIStudyCache.findOne({
    bookId,
    expiresAt: { $gt: now }
  }).lean()
  return cache
}

router.get(
  "/:bookId/summary",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCache(bookId)
    if (cached?.summary) {
      console.log(`[AIStudy] Returning cached summary for ${bookId}`)
      return res.json({ summary: cached.summary, cached: true, cachedAt: cached.generatedAt })
    }

    const book = await Book.findOne({ _id: bookId, isDeleted: false })
      .select("title author genre description tags")
      .lean()

    if (!book) throw new ApiError(404, "Book not found")

    console.log(`[AIStudy] Generating summary for: ${book.title}`)

    const summary = await generateBookSummary({
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description || "",
      tags: book.tags || []
    })

    await AIStudyCache.findOneAndUpdate(
      { bookId: new Types.ObjectId(bookId) },
      { $set: { summary, generatedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { upsert: true }
    )

    res.json({ summary, cached: false })
  })
)

router.get(
  "/:bookId/mcq",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params
    const count = Math.min(20, Math.max(5, parseInt(req.query.count as string) || 10))

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCache(bookId)
    if (cached?.mcq && cached.mcq.length > 0) {
      console.log(`[AIStudy] Returning cached MCQ for ${bookId}`)
      return res.json({ questions: cached.mcq, total: cached.mcq.length, cached: true })
    }

    const book = await Book.findOne({ _id: bookId, isDeleted: false })
      .select("title author genre description tags")
      .lean()

    if (!book) throw new ApiError(404, "Book not found")

    console.log(`[AIStudy] Generating ${count} MCQs for: ${book.title}`)

    const questions = await generateMCQQuestions({
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description || "",
      tags: book.tags || []
    }, count)

    await AIStudyCache.findOneAndUpdate(
      { bookId: new Types.ObjectId(bookId) },
      { $set: { mcq: questions, generatedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { upsert: true }
    )

    res.json({ questions, total: questions.length, cached: false })
  })
)

router.get(
  "/:bookId/key-points",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params

    if (!Types.ObjectId.isValid(bookId)) {
      throw new ApiError(400, "Invalid book ID")
    }

    const cached = await getCache(bookId)
    if (cached?.keyPoints) {
      console.log(`[AIStudy] Returning cached key points for ${bookId}`)
      return res.json({ keyPoints: cached.keyPoints, cached: true })
    }

    const book = await Book.findOne({ _id: bookId, isDeleted: false })
      .select("title author genre description tags")
      .lean()

    if (!book) throw new ApiError(404, "Book not found")

    console.log(`[AIStudy] Generating key points for: ${book.title}`)

    const keyPoints = await generateKeyPoints({
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description || "",
      tags: book.tags || []
    })

    await AIStudyCache.findOneAndUpdate(
      { bookId: new Types.ObjectId(bookId) },
      { $set: { keyPoints, generatedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { upsert: true }
    )

    res.json({ keyPoints, cached: false })
  })
)

router.delete(
  "/:bookId/cache",
  asyncHandler(async (req, res) => {
    const { bookId } = req.params

    if (req.user!.role !== "admin") {
      throw new ApiError(403, "Admin only")
    }

    await AIStudyCache.deleteOne({ bookId: new Types.ObjectId(bookId) })

    res.json({ message: "Cache cleared. Next request will regenerate." })
  })
)

export default router
