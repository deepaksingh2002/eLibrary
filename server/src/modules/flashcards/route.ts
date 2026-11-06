import { Router } from "express"
import { Types } from "mongoose"
import { protect } from "../../middleware/auth.middleware"
import { asyncHandler } from "../../utils/asyncHandler"
import { ApiError } from "../../utils/ApiError"
import Book from "../../models/Book"
import FlashcardDeck from "./model"
import { contentHash, createFlashcardModel, generateFlashcardDeck, splitChapterText } from "./service"
import { loadBookPDF } from "../../services/langchainPdfService"

const router = Router()
router.use(protect)

router.post("/", asyncHandler(async (req, res) => {
  const { bookId, chapterId } = req.body as { bookId?: string; chapterId?: string }
  if (!bookId || !chapterId || !Types.ObjectId.isValid(bookId)) throw new ApiError(400, "bookId and chapterId are required")
  const book = await Book.findById(bookId).select("title author genre pdfUrl").lean()
  if (!book?.pdfUrl) throw new ApiError(404, "Book PDF not found")
  const pdf = await loadBookPDF(book.pdfUrl, book.title)
  if (!pdf.success || !pdf.text) throw new ApiError(422, "Book text is not available")
  const hash = contentHash(`${chapterId}:${pdf.text}`)
  const existing = await FlashcardDeck.findOne({ bookId, chapterId, contentHash: hash, promptVersion: "v1" }).lean()
  if (existing) return res.json({ deck: existing, cached: true })
  const deck = await generateFlashcardDeck(splitChapterText(pdf.text), createFlashcardModel())
  const saved = await FlashcardDeck.create({ bookId, chapterId, contentHash: hash, promptVersion: "v1", model: process.env.GEMINI_MODEL || "gemini-2.0-flash", cards: deck.cards })
  return res.status(202).json({ jobId: `flashcards:${saved._id}`, deck: saved })
}))

router.get("/jobs/:id", asyncHandler(async (req, res) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const id = rawId.replace(/^flashcards:/, "")
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid flashcard job ID")
  const deck = await FlashcardDeck.findById(id).lean()
  res.json({ status: deck ? "completed" : "pending", deck })
}))

router.get("/:bookId/:chapterId", asyncHandler(async (req, res) => {
  const deck = await FlashcardDeck.findOne({ bookId: req.params.bookId, chapterId: req.params.chapterId }).sort({ createdAt: -1 }).lean()
  if (!deck) throw new ApiError(404, "Flashcard deck not found")
  res.json({ deck })
}))

export default router
