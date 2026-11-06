import fs from "fs"
import os from "os"
import path from "path"
import axios from "axios"
import {
  chapterForPage as resolveChapterForPage,
  detectChaptersFromPages as detectSemanticChaptersFromPages,
} from "../rag/chapterDetection"
import { buildChapterAwareChunks as buildSemanticChapterAwareChunks } from "../rag/chunkingService"
import { getPdfPageCount, ocrPdfPages } from "../ocr/ocrService"

export interface PdfPageRecord {
  pageNumber: number
  text: string
  chapter: string
  bookName: string
  source: "text" | "ocr"
  quality: number
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
  source: "text" | "ocr" | "mixed"
  usedOcr: boolean
  ocrFailedPages: number[]
  warnings: string[]
  error?: string
}

export interface ChapterAwareChunk {
  chunkIndex: number
  content: string
  chapter: string
  page: number
  bookName: string
}

const OCR_DPI = Number(process.env.PDF_OCR_DPI || 250)
const OCR_LANGUAGE = process.env.PDF_OCR_LANG || "eng"
const MIN_TEXT_WORDS = Number(process.env.PDF_TEXT_MIN_WORDS || 120)
const MIN_PAGE_WORDS = Number(process.env.PDF_TEXT_MIN_PAGE_WORDS || 18)

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function cleanupExtractedText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function removeRepeatedLinesAcrossPages<T extends { pageNumber: number; text: string }>(pages: T[]): T[] {
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
    } as T
  })
}

function cleanChunkText(text: string): string {
  const configuredTerms = (process.env.PDF_STRIP_TERMS || "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
  const stripped = configuredTerms.length > 0
    ? new RegExp(`\\b(?:${configuredTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi")
    : null
  return cleanupExtractedText(text)
    .replace(stripped || /$^/, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
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

async function extractTextPages(pdfBuffer: Buffer): Promise<{ pages: Array<{ pageNumber: number; text: string; source: "text"; quality: number }>; totalPages: number }> {
  const mupdf = await new Function("return import('mupdf')")() as typeof import("mupdf")
  const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf")
  try {
    const totalPages = document.countPages()
    const pages = Array.from({ length: totalPages }, (_, index) => {
      const page = document.loadPage(index)
      try {
        const text = cleanupExtractedText(page.toStructuredText({}).asText())
        const words = text.split(/\s+/).filter(Boolean).length
        const printable = text.replace(/[^\x20-\x7e\n\r\t]/g, "").length
        const quality = text.length > 0 ? printable / text.length : 0
        return { pageNumber: index + 1, text, source: "text" as const, quality: Math.min(1, quality * Math.min(1, words / MIN_PAGE_WORDS)) }
      } finally {
        page.destroy()
      }
    })
    return { pages, totalPages }
  } finally {
    document.destroy()
  }
}

function shouldUseOcr(page: { text: string; quality: number }): boolean {
  const words = page.text.split(/\s+/).filter((word) => word.length > 2).length
  return words < MIN_PAGE_WORDS || page.quality < 0.65
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
      ocrFailedPages: [],
      warnings: [],
      error: "Could not download PDF. Check if the PDF URL is accessible.",
    }
  }

  try {
    const textExtraction = await extractTextPages(buffer)
    const textPages = textExtraction.pages
    const totalPages = await getPdfPageCount(buffer)
    const pagesNeedingOcr = textPages.filter(shouldUseOcr).map((page) => page.pageNumber)
    const ocrPages = pagesNeedingOcr.length > 0
      ? await ocrPdfPages(buffer, totalPages, { dpi: OCR_DPI, language: OCR_LANGUAGE, pageNumbers: pagesNeedingOcr })
      : Object.assign([], { failedPages: [], warnings: [] })
    const ocrByPage = new Map(ocrPages.map((page) => [page.pageNumber, page]))
    const pages = textPages.map((page) => {
      const selected = ocrByPage.get(page.pageNumber) || page
      return { ...selected, text: cleanChunkText(selected.text) }
    })
    const source: "text" | "ocr" | "mixed" = pages.every((page) => page.source === "ocr")
      ? "ocr"
      : pages.some((page) => page.source === "ocr")
        ? "mixed"
        : "text"
    const usedOcr = ocrPages.length > 0 || pagesNeedingOcr.length > 0

    const cleanedRepeatedPages = removeRepeatedLinesAcrossPages(pages)
    const chapters = detectSemanticChaptersFromPages(cleanedRepeatedPages)
    const chapterAwarePages = cleanedRepeatedPages.map((page) => ({
      ...page,
      chapter: resolveChapterForPage(page.pageNumber, chapters),
      bookName,
    }))

    const hasChapters = chapters.length > 0
    const contentPages = hasChapters
      ? chapterAwarePages.filter((page) => page.chapter !== "Uncategorized")
      : chapterAwarePages

    const text = (contentPages.length > 0 ? contentPages : chapterAwarePages)
      .map((page) => page.text)
      .join("\n\n")
      .trim()

    if (text.length === 0) {
      return {
        success: false,
        pages: chapterAwarePages,
        chapters,
        totalPages,
        text: "",
        source,
        usedOcr,
        ocrFailedPages: ocrPages.failedPages,
        warnings: ocrPages.warnings,
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
      ocrFailedPages: ocrPages.failedPages,
      warnings: ocrPages.warnings,
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
      ocrFailedPages: [],
      warnings: [],
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
