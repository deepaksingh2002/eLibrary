import crypto from "crypto"
import Book from "../models/Book"
import BookVectorChunk from "../models/BookVectorChunk"
import { buildChapterAwareChunks, processBookPdf } from "./pdfPipelineService"
import { getGeminiEmbeddings } from "../embeddings/embeddingService"
import { isChapterMatch, mmrSelectChunks } from "../rag/retrievalService"

export type VectorStudyTask = "summary" | "mcq" | "keypoints"

export interface VectorStudyBook {
  _id: string
  title: string
  author: string
  genre: string
  description?: string
  pdfUrl?: string
}

export interface VectorContextResult {
  success: boolean
  text: string
  pages: number
  chunksUsed: number
  error?: string
}

const MAX_CONTEXT_CHUNKS = 12

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function buildTaskQueries(book: VectorStudyBook, task: VectorStudyTask, chapterFocus?: string): string[] {
  const base = `${book.title} ${book.author} ${book.genre}`
  const chapterHint = chapterFocus?.trim() || ""

  if (task === "summary") {
    return [
      `${base} overall themes central ideas structure`,
      `${book.title} chapter overview main concepts conclusion`,
      `${book.genre} book important ideas key arguments`,
    ]
  }

  if (task === "mcq") {
    return [
      chapterHint ? `${base} ${chapterHint} definitions facts terminology` : `${base} definitions facts terminology`,
      chapterHint ? `${book.title} ${chapterHint} examples applications formulas` : `${book.title} examples applications formulas`,
      chapterHint ? `${book.title} ${chapterHint} important concepts key details` : `${book.title} important concepts key details`,
      chapterHint ? `${book.title} ${chapterHint} exam facts chapter topics` : `${book.title} chapter topics exam facts`,
    ]
  }

  return [
    `${base} chapter headings key sections`,
    `${book.title} glossary important terms definitions`,
    `${book.title} takeaways exam tips interview topics`,
    `${book.title} important facts and concepts`,
  ]
}

function formatChunkContext(
  chunks: Array<{ chunkIndex: number; content: string; score: number }>,
): string {
  return chunks
    .map((chunk, index) => {
      const score = chunk.score.toFixed(3)
      return `[Chunk ${index + 1} | book-section ${chunk.chunkIndex} | score ${score}]\n${chunk.content}`
    })
    .join("\n\n")
}

export async function ensureBookVectorIndex(
  book: VectorStudyBook,
  options: { force?: boolean } = {},
): Promise<{
  success: boolean
  pages: number
  chunks: number
  error?: string
}> {
  const force = options.force === true

  if (!book.pdfUrl) {
    await Book.findByIdAndUpdate(book._id, {
      extractionStatus: "no_pdf",
      extractionError: "No PDF found for this book",
      pdfTextExtracted: false,
    })

    return { success: false, pages: 0, chunks: 0, error: "No PDF found for this book" }
  }

  const existingCount = await BookVectorChunk.countDocuments({ bookId: book._id })
  if (existingCount > 0 && !force) {
    return { success: true, pages: 0, chunks: existingCount }
  }

  const currentBook = await Book.findById(book._id).select("extractionStatus pdfUrl title")
  if (!force) {
    if (currentBook?.extractionStatus === "processing") {
      return {
        success: false,
        pages: 0,
        chunks: 0,
        error: "Book is currently being processed by a background worker. Please try again shortly.",
      }
    }

    if (
      currentBook?.extractionStatus === "pending" ||
      currentBook?.extractionStatus === "failed" ||
      currentBook?.extractionStatus === "no_pdf"
    ) {
      console.log(`[bookVectorService] Scheduling background indexing for book: ${book.title}`)
      const { scheduleBookAiProcessing } = require("./bookAiProcessing")
      scheduleBookAiProcessing({
        bookId: String(book._id),
        pdfUrl: book.pdfUrl || currentBook.pdfUrl || "",
        title: book.title || currentBook.title || "Unknown Book",
      })

      return {
        success: false,
        pages: 0,
        chunks: 0,
        error: "Book indexing has been triggered. Please wait a few minutes for AI study features to become available.",
      }
    }
  }

  await Book.findByIdAndUpdate(book._id, {
    extractionStatus: "processing",
    extractionError: "",
    pdfTextExtracted: false,
  })

  const pdf = await processBookPdf(book.pdfUrl, book.title)
  if (!pdf.success || !pdf.text) {
    await Book.findByIdAndUpdate(book._id, {
      extractionStatus: "failed",
      extractionError: pdf.error || "Could not read PDF text",
      pdfTextExtracted: false,
    })

    return {
      success: false,
      pages: pdf.totalPages || 0,
      chunks: 0,
      error: pdf.error || "Could not read PDF text",
    }
  }

  const chunks = (await buildChapterAwareChunks({
    pages: pdf.pages,
    bookName: book.title,
  })).filter((chunk) => chunk.content.length > 80)

  if (chunks.length === 0) {
    await Book.findByIdAndUpdate(book._id, {
      extractionStatus: "failed",
      extractionError: pdf.usedOcr
        ? "No readable OCR chunks were extracted from the PDF"
        : "No readable text chunks were extracted from the PDF",
      pdfTextExtracted: false,
    })

    return {
      success: false,
      pages: pdf.totalPages || 0,
      chunks: 0,
      error: pdf.usedOcr
        ? "No readable OCR chunks were extracted from the PDF"
        : "No readable text chunks were extracted from the PDF",
    }
  }

  const embeddings = getGeminiEmbeddings()
  const vectors = await embeddings.embedDocuments(chunks.map((chunk) => chunk.content))

  await BookVectorChunk.deleteMany({ bookId: book._id })
  await BookVectorChunk.insertMany(
    chunks.map((chunk, index) => ({
      bookId: book._id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: vectors[index] || [],
      chapter: chunk.chapter,
      page: chunk.page,
      bookName: chunk.bookName,
    })),
  )

  await Book.findByIdAndUpdate(book._id, {
    extractionStatus: "ready",
    extractionError: "",
    extractionPages: pdf.totalPages,
    extractedAt: new Date(),
    pdfTextExtracted: true,
  })

  return {
    success: true,
    pages: pdf.totalPages,
    chunks: chunks.length,
  }
}

async function retrieveRelevantChunks(
  book: VectorStudyBook,
  task: VectorStudyTask,
  limit: number,
  chapterFocus?: string,
): Promise<Array<{ chunkIndex: number; content: string; score: number }>> {
  const embeddings = getGeminiEmbeddings()
  const storedChunks = await BookVectorChunk.find({ bookId: book._id })
    .select("chunkIndex content embedding chapter page bookName")
    .sort({ chunkIndex: 1 })
    .lean()

  if (storedChunks.length === 0) {
    return []
  }

  const scopedChunks = chapterFocus
    ? storedChunks.filter((chunk) => chunk.chapter && isChapterMatch(chunk.chapter, chapterFocus))
    : storedChunks

  if (chapterFocus && scopedChunks.length === 0) {
    return []
  }

  const queries = buildTaskQueries(book, task, chapterFocus)
  const queryVectors = await Promise.all(queries.map((query) => embeddings.embedQuery(query)))

  return mmrSelectChunks({
    chunks: scopedChunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: chunk.embedding || [],
      chapter: chunk.chapter,
      page: chunk.page,
      bookName: chunk.bookName,
    })),
    queryVectors,
    limit,
    lambda: 0.72,
  }).map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    content: normalizeText(chunk.content),
    score: chunk.score,
  }))
}

export async function buildStudyContext(book: VectorStudyBook, task: VectorStudyTask, limit = MAX_CONTEXT_CHUNKS, chapterFocus?: string): Promise<VectorContextResult> {
  const indexResult = await ensureBookVectorIndex(book)
  if (!indexResult.success && indexResult.error) {
    return {
      success: false,
      text: "",
      pages: indexResult.pages,
      chunksUsed: 0,
      error: indexResult.error,
    }
  }

  const chunks = await retrieveRelevantChunks(book, task, limit, chapterFocus)
  if (chunks.length === 0) {
    return {
      success: false,
      text: "",
      pages: indexResult.pages,
      chunksUsed: 0,
      error: "No relevant vector chunks were found for this book",
    }
  }

  const text = formatChunkContext(chunks)
  if (!text) {
    return {
      success: false,
      text: "",
      pages: indexResult.pages,
      chunksUsed: 0,
      error: "Vector context could not be assembled",
    }
  }

  return {
    success: true,
    text,
    pages: indexResult.pages,
    chunksUsed: chunks.length,
  }
}

export function vectorCacheKey(bookId: string, task: VectorStudyTask, variant: string): string {
  return crypto.createHash("sha1").update(`${bookId}:${task}:${variant}`).digest("hex")
}
