import Book from "../models/Book"
import {
  generateSummary as generateSummaryFromContext,
  generateMCQ as generateMCQFromContext,
  generateKeyPoints as generateKeyPointsFromContext,
  generateKeyPointsForChapter,
  loadBookPDF,
  loadBookPDFPages,
  extractChapterIndexFromPages,
  extractChapterIndexFromPagesAsync,
  sanitizeChapterRanges,
  resolveChapterRange,
  slicePagesForChapter,
} from "./langchainPdfService"
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

export interface MCQStudyResult {
  questions: MCQQuestion[]
  fallbackUsed: boolean
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

export interface ChapterIndexEntry {
  number: number
  title: string
  startPage: number
  endPage: number
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

async function getOptionalStudyContext(
  book: VectorStudyBook,
  task: VectorStudyTask,
  limit: number,
  chapterFocus?: string,
) {
  try {
    return await buildStudyContext(book, task, limit, chapterFocus)
  } catch (error: any) {
    console.warn("[AIStudy] Optional vector context unavailable:", error?.message || error)
    return null
  }
}

async function getPdfText(book: BookForAI) {
  const resolved = await resolveBook(book)

  if (!resolved.pdfUrl) {
    return null
  }

  const pdf = await loadBookPDF(resolved.pdfUrl, resolved.title)
  if (!pdf.success || !pdf.text) {
    return null
  }

  return {
    text: pdf.text,
    title: resolved.title,
    author: resolved.author,
    genre: resolved.genre,
  }
}

async function getPdfPages(book: BookForAI) {
  const resolved = await resolveBook(book)

  if (!resolved.pdfUrl) {
    return null
  }

  const pdf = await loadBookPDFPages(resolved.pdfUrl, resolved.title)
  if (!pdf.success || !pdf.pages || pdf.pages.length === 0) {
    return null
  }

  return {
    pages: pdf.pages,
    totalPages: pdf.totalPages,
    title: resolved.title,
    author: resolved.author,
    genre: resolved.genre,
    chapters: sanitizeChapterRanges(
      (pdf.chapters || []).map((chapter, index) => ({
        number: index + 1,
        title: chapter.chapter,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
      })),
      pdf.totalPages,
    ).map((chapter) => ({
      chapter: chapter.title,
      startPage: chapter.startPage,
      endPage: chapter.endPage,
    })),
    usedOcr: pdf.usedOcr || false,
  }
}

export async function getBookChapterIndex(book: BookForAI): Promise<{ chapters: ChapterIndexEntry[]; basedOnPDF: boolean }> {
  try {
    const pdf = await getPdfPages(book)
    if (!pdf) {
      return { chapters: [], basedOnPDF: false }
    }

    if (Array.isArray(pdf.chapters) && pdf.chapters.length > 1) {
      return {
        chapters: pdf.chapters.map((chapter, index) => ({
          number: index + 1,
          title: chapter.chapter,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
        })),
        basedOnPDF: true,
      }
    }

    const chapters = await extractChapterIndexFromPagesAsync(pdf.pages, pdf.totalPages, pdf.title)

    return {
      chapters,
      basedOnPDF: chapters.length > 0,
    }
  } catch (error: any) {
    console.error("[AIStudy] Chapter index generation failed:", error?.message || error)
    return { chapters: [], basedOnPDF: false }
  }
}

export async function generateBookSummary(book: BookForAI): Promise<BookSummary> {
  try {
    const pdf = await getPdfText(book)
    if (pdf) {
      return generateSummaryFromContext(
        pdf.text,
        pdf.title,
        pdf.author,
        pdf.genre,
      )
    }

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
  chapterFocus?: string,
): Promise<MCQStudyResult> {
  try {
    const resolved = await resolveBook(book)
    const pdfPages = await getPdfPages(book)
    if (pdfPages) {
      const chapters = Array.isArray(pdfPages.chapters) && pdfPages.chapters.length > 0
        ? pdfPages.chapters.map((chapter, index) => ({
            number: index + 1,
            title: chapter.chapter,
            startPage: chapter.startPage,
            endPage: chapter.endPage,
          }))
        : await extractChapterIndexFromPagesAsync(pdfPages.pages, pdfPages.totalPages, pdfPages.title)
      
      const selectedChapter = chapterFocus && chapterFocus !== "all"
        ? (resolveChapterRange(chapters, chapterFocus) || chapters[0] || null)
        : null

      const contentPages = chapters.length > 0
        ? pdfPages.pages.filter((page) => {
            const pageNum = page.pageNumber
            return chapters.some((ch) => pageNum >= ch.startPage && pageNum <= ch.endPage)
          })
        : pdfPages.pages

      const chapterText = selectedChapter
        ? slicePagesForChapter(pdfPages.pages, selectedChapter)
        : (contentPages.length > 0 ? contentPages : pdfPages.pages).map((page) => page.text).join("\n\n")

      const chapterLabel = selectedChapter
        ? `Chapter ${selectedChapter.number}: ${selectedChapter.title}`
        : chapterFocus || "All chapters"

      const retrieverFocus = chapterFocus || chapterLabel
      const vectorContext = await getOptionalStudyContext(resolved, "mcq", Math.max(10, count), retrieverFocus)
      const combinedContext = [chapterText, vectorContext?.success ? vectorContext.text : ""]
        .filter((value) => value.trim().length > 0)
        .join("\n\n")

      return generateMCQFromContext(
        combinedContext || chapterText || pdfPages.pages.map((page) => page.text).join("\n\n"),
        pdfPages.title,
        count,
        chapterLabel,
      )
    }

    const context = await buildStudyContext(resolved, "mcq", Math.max(10, count), chapterFocus)
    if (!context.success || !context.text) {
      console.error("[AIStudy] MCQ vector context failed:", context.error)
      return { questions: [], fallbackUsed: false }
    }

    return generateMCQFromContext(
      context.text,
      book.title || "Unknown Title",
      count,
      chapterFocus,
    )
  } catch (error: any) {
    console.error("[AIStudy] MCQ generation failed:", error?.message || error)
    return { questions: [], fallbackUsed: false }
  }
}

export async function generateKeyPoints(book: BookForAI, chapterFocus?: string): Promise<KeyPoints> {
  try {
    const pdfPages = await getPdfPages(book)
    if (pdfPages) {
      const chapters = Array.isArray(pdfPages.chapters) && pdfPages.chapters.length > 0
        ? pdfPages.chapters.map((chapter, index) => ({
            number: index + 1,
            title: chapter.chapter,
            startPage: chapter.startPage,
            endPage: chapter.endPage,
          }))
        : await extractChapterIndexFromPagesAsync(pdfPages.pages, pdfPages.totalPages, pdfPages.title)

      // Filter chapters based on chapterFocus if specified
      let chaptersToProcess = chapters
      if (chapterFocus && chapterFocus !== "all") {
        const selected = resolveChapterRange(chapters, chapterFocus)
        if (selected) {
          chaptersToProcess = [selected]
        }
      }

      if (chaptersToProcess.length === 0) {
        return {
          chapters: [],
          glossary: [],
          takeaways: [],
          examTips: [],
          interviewTopics: [],
          basedOnPDF: true,
        }
      }

      // Generate key points for the selected chapters
      // We will do this in batches of 3 to avoid rate limits
      const results: any[] = []
      const batchSize = 3
      for (let i = 0; i < chaptersToProcess.length; i += batchSize) {
        const batch = chaptersToProcess.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(async (ch) => {
            const chText = slicePagesForChapter(pdfPages.pages, ch)
            if (!chText || chText.trim().length < 200) {
              return null
            }
            try {
              return await generateKeyPointsForChapter(chText, pdfPages.title, ch.title, ch.number)
            } catch (err) {
              console.error(`[KeyPoints] Failed for chapter ${ch.number}:`, err)
              return null
            }
          })
        )
        results.push(...batchResults)
      }

      const validResults = results.filter(Boolean)
      if (validResults.length === 0) {
        return {
          chapters: [],
          glossary: [],
          takeaways: [],
          examTips: [],
          interviewTopics: [],
          basedOnPDF: true,
        }
      }

      // Merge results!
      const mergedChapters = validResults.map((r) => ({
        number: r.number,
        title: r.title,
        points: r.points,
      }))

      // Deduplicate glossary by term
      const glossaryMap = new Map<string, string>()
      validResults.forEach((r) => {
        if (Array.isArray(r.glossary)) {
          r.glossary.forEach((g: any) => {
            if (g.term && g.definition) {
              glossaryMap.set(g.term.trim().toLowerCase(), g.definition.trim())
            }
          })
        }
      })
      const mergedGlossary = Array.from(glossaryMap.entries()).map(([term, definition]) => ({
        term: term.charAt(0).toUpperCase() + term.slice(1),
        definition,
      }))

      // Collect takeaways, examTips, interviewTopics
      const mergedTakeaways = Array.from(new Set(validResults.flatMap((r) => r.takeaways || [])))
      const mergedExamTips = Array.from(new Set(validResults.flatMap((r) => r.examTips || [])))
      const mergedInterviewTopics = Array.from(new Set(validResults.flatMap((r) => r.interviewTopics || [])))

      return {
        chapters: mergedChapters,
        glossary: mergedGlossary,
        takeaways: mergedTakeaways,
        examTips: mergedExamTips,
        interviewTopics: mergedInterviewTopics,
        basedOnPDF: true,
      }
    }

    const context = await getContext(book, "keypoints", 12)
    if (!context.success || !context.text) {
      console.error("[AIStudy] Key points vector context failed:", context.error)
      return {
        ...FALLBACK_KEY_POINTS,
        chapters: [{ title: "Unavailable", points: [context.error || "Try again later"] }],
      }
    }

    const keyPoints = await generateKeyPointsFromContext(
      context.text,
      book.title || "Unknown Title",
      book.author || "Unknown Author",
      book.genre || "Unknown Genre",
    )

    return {
      ...keyPoints,
      chapters: keyPoints.chapters.map((ch, idx) => ({
        number: idx + 1,
        title: ch.title,
        points: ch.points,
      })),
    }
  } catch (error: any) {
    console.error("[AIStudy] Key points generation failed:", error?.message || error)
    return FALLBACK_KEY_POINTS
  }
}
