import { ChapterMetadata, LearningPage } from "../types/aiLearning"
import { normalizeWhitespace } from "../utils/textCleanup"

function normalizeChapterTitle(title: string): string {
  return normalizeWhitespace(title)
    .replace(/^(chapter|chap\.?)\s*/i, "Chapter ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function detectChapterHeading(line: string): string | null {
  const normalized = normalizeWhitespace(line)
  if (normalized.length < 4 || normalized.length > 140) return null

  const chapterMatch = normalized.match(/^chapter\s+([0-9ivxlcdm]+)\s*[:.\-\s]\s*(.{3,120})$/i)
  if (chapterMatch?.[2]) {
    return normalizeChapterTitle(`Chapter ${chapterMatch[1].toUpperCase()}: ${chapterMatch[2]}`)
  }

  const numberedMatch = normalized.match(/^([0-9]+)[\.)]\s+([A-Z][A-Za-z0-9 ,:'\-]{3,120})$/)
  if (numberedMatch?.[2]) {
    return normalizeChapterTitle(`Chapter ${numberedMatch[1]}: ${numberedMatch[2]}`)
  }

  return null
}

export function detectChaptersFromPages(pages: LearningPage[]): ChapterMetadata[] {
  const candidates: Array<{ chapter: string; startPage: number }> = []

  for (const page of pages) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean)
    for (const line of lines.slice(0, 10)) {
      const heading = detectChapterHeading(line)
      if (heading) {
        candidates.push({ chapter: heading, startPage: page.pageNumber })
        break
      }
    }
  }

  const deduped = Array.from(
    new Map(candidates.map((candidate) => [`${candidate.startPage}:${candidate.chapter.toLowerCase()}`, candidate])).values(),
  ).sort((left, right) => left.startPage - right.startPage)

  return deduped.map((entry, index, items) => ({
    chapter: entry.chapter,
    startPage: entry.startPage,
    endPage: Math.max(
      entry.startPage,
      (items[index + 1]?.startPage || (pages[pages.length - 1]?.pageNumber || entry.startPage) + 1) - 1,
    ),
  }))
}

export function chapterForPage(pageNumber: number, chapters: ChapterMetadata[]): string {
  return chapters.find((chapter) => pageNumber >= chapter.startPage && pageNumber <= chapter.endPage)?.chapter || "Uncategorized"
}
