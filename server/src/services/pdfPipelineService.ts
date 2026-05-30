import fs from "fs"
import os from "os"
import path from "path"
import axios from "axios"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { cleanupOcrText, removeRepeatedPageLines } from "../utils/textCleanup"
import {
  chapterForPage as resolveChapterForPage,
  detectChaptersFromPages as detectSemanticChaptersFromPages,
} from "../rag/chapterDetection"
import { buildChapterAwareChunks as buildSemanticChapterAwareChunks } from "../rag/chunkingService"
import { ocrPdfPages } from "../ocr/ocrService"

export interface PdfPageRecord {
  pageNumber: number
  text: string
  chapter: string
  bookName: string
}

export interface PdfChapterRange {
  chapter: string
  startPage: number
  endPage: number
}

export interface PdfProcessingResult {
  success: boolean
  pages: PdfPageRecord[]
  chapters: PdfChapterRange[]
  totalPages: number
  text: string
  source: "text" | "ocr"
  usedOcr: boolean
  error?: string
}

export interface ChapterAwareChunk {
  chunkIndex: number
  content: string
  chapter: string
  page: number
  bookName: string
}

const OCR_DPI = Number(process.env.PDF_OCR_DPI || 220)
const OCR_LANGUAGE = process.env.PDF_OCR_LANG || "eng"
const MIN_TEXT_WORDS = Number(process.env.PDF_TEXT_MIN_WORDS || 120)
const MIN_PAGE_WORDS = Number(process.env.PDF_TEXT_MIN_PAGE_WORDS || 18)
const BANNED_TERMS = ["meap", "manning", "copyright", "isbn", "publisher", "table of contents"]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function isNoiseLine(line: string): boolean {
  const lowered = line.toLowerCase()

  return (
    !line ||
    /^page\s*\d+$/i.test(line) ||
    /^\d+$/i.test(line) ||
    /https?:\/\//i.test(line) ||
    /\bisbn\b/i.test(line) ||
    /\bcopyright\b/i.test(line) ||
    /\bmanning\b/i.test(line) ||
    /\bmeap\b/i.test(line) ||
    /publisher\s+notes?/i.test(line) ||
    /table of contents/i.test(line) ||
    lowered.includes("all rights reserved")
  )
}

function cleanupExtractedText(text: string): string {
  return cleanupOcrText(text)
}

function removeRepeatedLinesAcrossPages(pages: Array<{ pageNumber: number; text: string }>): Array<{ pageNumber: number; text: string }> {
  const lineCounts = new Map<string, number>()

  for (const page of pages) {
    const uniqueLines = new Set(
      page.text
        .split(/\n+/)
        .map((line) => normalizeWhitespace(line))
        .filter((line) => line.length > 0),
    )

    for (const line of uniqueLines) {
      if (line.length > 120) {
        continue
      }

      lineCounts.set(line.toLowerCase(), (lineCounts.get(line.toLowerCase()) || 0) + 1)
    }
  }

  const repeatThreshold = Math.max(2, Math.ceil(pages.length * 0.5))

  return pages.map((page) => {
    const cleanedLines = page.text
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter((line) => {
        if (!line) return false
        const count = lineCounts.get(line.toLowerCase()) || 0
        return count < repeatThreshold
      })

    return {
      ...page,
      text: cleanedLines.join("\n").trim(),
    }
  })
}

function cleanChunkText(text: string): string {
  return cleanupExtractedText(text)
    .replace(/\b(MEAP|Manning|copyright|isbn|publisher notes?)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function hasBannedTerms(text: string): boolean {
  const lowered = text.toLowerCase()
  return BANNED_TERMS.some((term) => lowered.includes(term))
}

async function downloadPdfToTempFile(pdfUrl: string, bookName: string): Promise<{ tmpPath: string | null; buffer: Buffer | null }> {
  const safeName = bookName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50)
  const tmpPath = path.join(os.tmpdir(), `elibrary_${Date.now()}_${safeName}.pdf`)

  try {
    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 80 * 1024 * 1024,
      headers: {
        "User-Agent": "eLibrary-Server/1.0",
      },
    })

    const buffer = Buffer.from(response.data)
    fs.writeFileSync(tmpPath, buffer)
    return { tmpPath, buffer }
  } catch (error) {
    console.error("[PdfPipeline] PDF download failed:", error instanceof Error ? error.message : String(error))
    return { tmpPath: null, buffer: null }
  }
}

function cleanupTempFile(tmpPath: string): void {
  try {
    fs.unlinkSync(tmpPath)
  } catch {
    // ignore cleanup failures
  }
}

function normalizeChapterLabel(label: string): string {
  return normalizeWhitespace(label).toLowerCase()
}

function detectChapterHeading(line: string): string | null {
  const normalized = normalizeWhitespace(line)
  if (!normalized || normalized.length < 4) {
    return null
  }

  const chapterMatch = normalized.match(/^chapter\s+([0-9ivxlcdm]+)[:.\-\s]+(.{3,120})$/i)
  if (chapterMatch?.[2]) {
    return `Chapter ${chapterMatch[1].toUpperCase()}: ${chapterMatch[2].trim()}`
  }

  const numericMatch = normalized.match(/^([0-9]+)[\.)]\s+(.{3,120})$/)
  if (numericMatch?.[2]) {
    return `Chapter ${numericMatch[1]}: ${numericMatch[2].trim()}`
  }

  return null
}

function detectChaptersFromPages(pages: Array<{ pageNumber: number; text: string }>): PdfChapterRange[] {
  const candidates: Array<{ chapter: string; startPage: number }> = []

  for (const page of pages) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean)

    for (const line of lines.slice(0, 8)) {
      const heading = detectChapterHeading(line)
      if (heading) {
        candidates.push({ chapter: heading, startPage: page.pageNumber })
        break
      }
    }
  }

  const deduped = Array.from(
    new Map(candidates.map((entry) => [`${entry.startPage}:${normalizeChapterLabel(entry.chapter)}`, entry])).values(),
  ).sort((left, right) => left.startPage - right.startPage)

  if (deduped.length === 0) {
    return []
  }

  return deduped.map((entry, index, items) => ({
    chapter: entry.chapter,
    startPage: entry.startPage,
    endPage: Math.max(
      entry.startPage,
      (items[index + 1]?.startPage || (pages[pages.length - 1]?.pageNumber || entry.startPage + 1) + 1) - 1,
    ),
  }))
}

function chapterForPage(pageNumber: number, chapters: PdfChapterRange[]): string {
  const match = chapters.find((chapter) => pageNumber >= chapter.startPage && pageNumber <= chapter.endPage)
  return match?.chapter || "Uncategorized"
}

async function extractTextPages(tmpPath: string, bookName: string): Promise<{ pages: Array<{ pageNumber: number; text: string }>; totalPages: number }> {
  const loader = new PDFLoader(tmpPath, { splitPages: true })
  const docs = await loader.load()

  if (!docs || docs.length === 0) {
    return { pages: [], totalPages: 0 }
  }

  const pages = docs
    .map((doc, index) => {
      const metadata = doc.metadata as any
      const pageNumber = metadata?.loc?.pageNumber || metadata?.pageNumber || metadata?.page || index + 1

      return {
        pageNumber: Number.isFinite(Number(pageNumber)) ? Number(pageNumber) : index + 1,
        text: cleanupExtractedText(doc.pageContent || ""),
      }
    })
    .filter((page) => page.text.length > 0)

  const metadata = docs[0]?.metadata as any
  const totalPages = metadata?.pdf?.totalPages || pages.length

  return { pages, totalPages }
}

function shouldUseOcr(pages: Array<{ pageNumber: number; text: string }>): boolean {
  const words = pages
    .map((page) => page.text.split(/\s+/).filter((word) => word.length > 2).length)
    .reduce((sum, count) => sum + count, 0)

  const averageWordsPerPage = pages.length > 0 ? words / pages.length : 0

  return words < MIN_TEXT_WORDS || averageWordsPerPage < MIN_PAGE_WORDS
}

export async function processBookPdf(pdfUrl: string, bookName: string): Promise<PdfProcessingResult> {
  const { tmpPath, buffer } = await downloadPdfToTempFile(pdfUrl, bookName)

  if (!tmpPath || !buffer) {
    return {
      success: false,
      pages: [],
      chapters: [],
      totalPages: 0,
      text: "",
      source: "text",
      usedOcr: false,
      error: "Could not download PDF. Check if the PDF URL is accessible.",
    }
  }

  try {
    const textExtraction = await extractTextPages(tmpPath, bookName)
    const textPages = textExtraction.pages
    const totalPages = textExtraction.totalPages

    let pages = textPages
    let source: "text" | "ocr" = "text"
    let usedOcr = false

    if (textPages.length === 0 || shouldUseOcr(textPages)) {
      pages = await ocrPdfPages(buffer, totalPages, {
        dpi: OCR_DPI,
        language: OCR_LANGUAGE,
      })
      source = "ocr"
      usedOcr = true
    }

    const cleanedRepeatedPages = removeRepeatedPageLines(pages)
    const chapters = detectSemanticChaptersFromPages(cleanedRepeatedPages)
    const chapterAwarePages = cleanedRepeatedPages.map((page) => ({
      ...page,
      chapter: resolveChapterForPage(page.pageNumber, chapters),
      bookName,
    }))

    const text = chapterAwarePages.map((page) => page.text).join("\n\n").trim()

    if (text.length === 0) {
      return {
        success: false,
        pages: chapterAwarePages,
        chapters,
        totalPages,
        text: "",
        source,
        usedOcr,
        error: "No readable text could be extracted from the PDF",
      }
    }

    return {
      success: true,
      pages: chapterAwarePages,
      chapters,
      totalPages,
      text,
      source,
      usedOcr,
    }
  } catch (error) {
    return {
      success: false,
      pages: [],
      chapters: [],
      totalPages: 0,
      text: "",
      source: "text",
      usedOcr: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    cleanupTempFile(tmpPath)
  }
}

export async function buildChapterAwareChunks(params: {
  pages: PdfPageRecord[]
  bookName: string
}): Promise<ChapterAwareChunk[]> {
  return buildSemanticChapterAwareChunks(params)
}
