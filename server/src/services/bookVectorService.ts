import crypto from "crypto"
import { OpenAIEmbeddings } from "@langchain/openai"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import Book from "../models/Book"
import BookVectorChunk from "../models/BookVectorChunk"
import { loadBookPDF } from "./langchainPdfService"

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

const VECTOR_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
const MAX_CONTEXT_CHUNKS = 12

function getEmbeddingsModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set")
  }

  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: VECTOR_MODEL,
  })
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] || 0
    const rightValue = right[index] || 0
    dot += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

function buildTaskQueries(book: VectorStudyBook, task: VectorStudyTask): string[] {
  const base = `${book.title} ${book.author} ${book.genre}`

  if (task === "summary") {
    return [
      `${base} overall themes central ideas structure`,
      `${book.title} chapter overview main concepts conclusion`,
      `${book.genre} book important ideas key arguments`,
    ]
  }

  if (task === "mcq") {
    return [
      `${base} definitions facts terminology`,
      `${book.title} examples applications formulas`,
      `${book.title} important concepts key details`,
      `${book.title} chapter topics exam facts`,
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

  await Book.findByIdAndUpdate(book._id, {
    extractionStatus: "processing",
    extractionError: "",
    pdfTextExtracted: false,
  })

  const pdf = await loadBookPDF(book.pdfUrl, book.title)
  if (!pdf.success || !pdf.text) {
    await Book.findByIdAndUpdate(book._id, {
      extractionStatus: "failed",
      extractionError: pdf.error || "Could not read PDF text",
      pdfTextExtracted: false,
    })

    return {
      success: false,
      pages: pdf.pages || 0,
      chunks: 0,
      error: pdf.error || "Could not read PDF text",
    }
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1400,
    chunkOverlap: 220,
  })

  const docs = await splitter.createDocuments([pdf.text])
  const chunks = docs
    .map((doc, index) => ({
      chunkIndex: index,
      content: normalizeText(doc.pageContent),
    }))
    .filter((chunk) => chunk.content.length > 80)

  if (chunks.length === 0) {
    await Book.findByIdAndUpdate(book._id, {
      extractionStatus: "failed",
      extractionError: "No readable text chunks were extracted from the PDF",
      pdfTextExtracted: false,
    })

    return {
      success: false,
      pages: pdf.pages || 0,
      chunks: 0,
      error: "No readable text chunks were extracted from the PDF",
    }
  }

  const embeddings = getEmbeddingsModel()
  const vectors = await embeddings.embedDocuments(chunks.map((chunk) => chunk.content))

  await BookVectorChunk.deleteMany({ bookId: book._id })
  await BookVectorChunk.insertMany(
    chunks.map((chunk, index) => ({
      bookId: book._id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: vectors[index] || [],
    })),
  )

  await Book.findByIdAndUpdate(book._id, {
    extractionStatus: "ready",
    extractionError: "",
    extractionPages: pdf.pages,
    extractedAt: new Date(),
    pdfTextExtracted: true,
  })

  return {
    success: true,
    pages: pdf.pages,
    chunks: chunks.length,
  }
}

async function retrieveRelevantChunks(
  book: VectorStudyBook,
  task: VectorStudyTask,
  limit: number,
): Promise<Array<{ chunkIndex: number; content: string; score: number }>> {
  const embeddings = getEmbeddingsModel()
  const storedChunks = await BookVectorChunk.find({ bookId: book._id })
    .select("chunkIndex content embedding")
    .sort({ chunkIndex: 1 })
    .lean()

  if (storedChunks.length === 0) {
    return []
  }

  const queries = buildTaskQueries(book, task)
  const queryVectors = await Promise.all(queries.map((query) => embeddings.embedQuery(query)))

  const scored = storedChunks.map((chunk) => {
    const score = Math.max(
      ...queryVectors.map((queryVector) => cosineSimilarity(chunk.embedding || [], queryVector)),
    )

    return {
      chunkIndex: chunk.chunkIndex,
      content: normalizeText(chunk.content),
      score,
    }
  })

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.chunkIndex - right.chunkIndex
    })
    .slice(0, limit)
}

export async function buildStudyContext(book: VectorStudyBook, task: VectorStudyTask, limit = MAX_CONTEXT_CHUNKS): Promise<VectorContextResult> {
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

  const chunks = await retrieveRelevantChunks(book, task, limit)
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