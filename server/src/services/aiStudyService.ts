import Book from "../models/Book"
import { generateSummary as generateSummaryFromContext, generateMCQ as generateMCQFromContext, generateKeyPoints as generateKeyPointsFromContext } from "./langchainPdfService"
import { buildStudyContext, VectorStudyBook, VectorStudyTask } from "./bookVectorService"

export interface BookSummary {
  overview: string
  keyThemes: string[]
  targetReader: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  estimatedTime: string
  basedOnPDF: boolean
}

export interface MCQQuestion {
  id: number
  question: string
  options: {
    A: string
    B: string
    C: string
    D: string
  }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}

export interface KeyPoints {
  chapters: {
    title: string
    points: string[]
  }[]
  glossary: {
    term: string
    definition: string
  }[]
  takeaways: string[]
  examTips: string[]
  interviewTopics: string[]
  basedOnPDF: boolean
}

export interface BookForAI {
  _id: string
  title?: string
  author?: string
  genre?: string
  description?: string
  tags?: string[]
  pdfUrl?: string
  extractionStatus?: string
}

const FALLBACK_SUMMARY: BookSummary = {
  overview: "This book's PDF could not be indexed yet. Please try again after the PDF vector index finishes building.",
  keyThemes: ["Vector indexing pending"],
  targetReader: "Unavailable",
  difficulty: "Intermediate",
  estimatedTime: "Unknown",
  basedOnPDF: false,
}

const FALLBACK_KEY_POINTS: KeyPoints = {
  chapters: [{ title: "Pending", points: ["Vector index not ready"] }],
  glossary: [],
  takeaways: [],
  examTips: [],
  interviewTopics: [],
  basedOnPDF: false,
}

async function resolveBook(book: BookForAI): Promise<VectorStudyBook> {
  if (book.title && book.author && book.genre && book.pdfUrl !== undefined) {
    return {
      _id: book._id,
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description || "",
      pdfUrl: book.pdfUrl,
    }
  }

  const found = await Book.findById(book._id)
    .select("title author genre description pdfUrl")
    .lean()

  if (!found) {
    throw new Error("Book not found")
  }

  return {
    _id: book._id,
    title: found.title,
    author: found.author,
    genre: found.genre,
    description: found.description || "",
    pdfUrl: found.pdfUrl || "",
  }
}

async function getContext(book: BookForAI, task: VectorStudyTask, limit: number) {
  const resolved = await resolveBook(book)
  return buildStudyContext(resolved, task, limit)
}

export async function generateBookSummary(book: BookForAI): Promise<BookSummary> {
  try {
    const context = await getContext(book, "summary", 10)
    if (!context.success || !context.text) {
      console.error("[AIStudy] Summary vector context failed:", context.error)
      return {
        ...FALLBACK_SUMMARY,
        overview: context.error || FALLBACK_SUMMARY.overview,
      }
    }

    return generateSummaryFromContext(
      context.text,
      book.title || "Unknown Title",
      book.author || "Unknown Author",
      book.genre || "Unknown Genre",
    )
  } catch (error: any) {
    console.error("[AIStudy] Summary generation failed:", error?.message || error)
    return FALLBACK_SUMMARY
  }
}

export async function generateMCQQuestions(
  book: BookForAI,
  count = 10,
): Promise<MCQQuestion[]> {
  try {
    const context = await getContext(book, "mcq", Math.max(10, count))
    if (!context.success || !context.text) {
      console.error("[AIStudy] MCQ vector context failed:", context.error)
      return []
    }

    return generateMCQFromContext(
      context.text,
      book.title || "Unknown Title",
      count,
    )
  } catch (error: any) {
    console.error("[AIStudy] MCQ generation failed:", error?.message || error)
    return []
  }
}

export async function generateKeyPoints(book: BookForAI): Promise<KeyPoints> {
  try {
    const context = await getContext(book, "keypoints", 12)
    if (!context.success || !context.text) {
      console.error("[AIStudy] Key points vector context failed:", context.error)
      return {
        ...FALLBACK_KEY_POINTS,
        chapters: [{ title: "Unavailable", points: [context.error || "Try again later"] }],
      }
    }

    return generateKeyPointsFromContext(
      context.text,
      book.title || "Unknown Title",
      book.author || "Unknown Author",
      book.genre || "Unknown Genre",
    )
  } catch (error: any) {
    console.error("[AIStudy] Key points generation failed:", error?.message || error)
    return FALLBACK_KEY_POINTS
  }
}
