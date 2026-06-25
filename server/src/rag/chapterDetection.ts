import { ChapterMetadata, LearningPage } from "../types/aiLearning"
import { normalizeWhitespace } from "../utils/textCleanup"

function normalizeChapterTitle(title: string): string {
  let normalized = normalizeWhitespace(title)
    .replace(/\s*\.{2,}\s*\d+$/g, "")
    .replace(/\s*\.{2,}\s*$/g, "")

  normalized = normalized
    .replace(/^(chapter|chap\.?)\s*([0-9ivxlcdm]+)?\s*[:.\-\s]*/i, (_match, label: string, number: string) => {
      const prefix = label.toLowerCase().startsWith("chap") ? "Chapter" : "Chapter"
      return number ? `${prefix} ${number.toUpperCase()}: ` : `${prefix}: `
    })
    .replace(/^(part|section|appendix)\s*([0-9ivxlcdm]+)?\s*[:.\-\s]*/i, (_match, label: string, number: string) => {
      const prefix = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
      return number ? `${prefix} ${number.toUpperCase()}: ` : `${prefix}: `
    })
    .replace(/\s{2,}/g, " ")

  const proseFragment = normalized.match(/^(Chapter\s+[0-9IVXLCDM]+:\s*)?(talks about|describes|explains|shows|covers|introduces|examines|focuses on)\s+(.+)$/i)
  if (proseFragment?.[3]) {
    const cleaned = proseFragment[3]
      .replace(/\b(and|while|because|where|when|as)\b.*$/i, "")
      .replace(/[.;:!?].*$/, "")
      .trim()

    if (cleaned.length >= 3) {
      normalized = normalized.replace(/^(Chapter\s+[0-9IVXLCDM]+:\s*)?.+$/i, (match) => {
        const chapterPrefix = match.match(/^(Chapter\s+[0-9IVXLCDM]+:\s*)/i)?.[1] || ""
        return `${chapterPrefix}${cleaned}`
      })
    }
  }

  return normalized.replace(/\s{2,}/g, " ").trim()
}

function romanToInt(roman: string): number {
  if (!roman) return 0

  const valueMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  let previous = 0
  const upper = roman.trim().toUpperCase()

  for (let index = upper.length - 1; index >= 0; index -= 1) {
    const value = valueMap[upper[index]] || 0
    if (value < previous) {
      total -= value
    } else {
      total += value
    }
    previous = value
  }

  return total
}

function parseTocLine(line: string): { title: string; startPage: number } | null {
  const normalized = normalizeWhitespace(line).replace(/^[•·\-–—]+\s*/, "")
  if (!normalized || normalized.length < 6 || !/[A-Za-z]/.test(normalized)) {
    return null
  }

  const pageMatch = normalized.match(/(\d{1,4}|[ivxlcdmIVXLCDM]+)\s*$/)
  if (!pageMatch) {
    return null
  }

  const rawPage = pageMatch[1]
  const startPage = /^\d+$/.test(rawPage) ? Number(rawPage) : romanToInt(rawPage)
  if (!Number.isFinite(startPage) || startPage < 1) {
    return null
  }

  const rawTitle = normalized.slice(0, pageMatch.index).replace(/\.{2,}\s*$/, "").trim()
  const title = normalizeChapterTitle(rawTitle.replace(/\.{2,}\s*$/g, ""))

  if (!title || title.length < 3) {
    return null
  }

  if (/^(contents|table of contents|index|preface|acknowledg(e)?ments|foreword|introduction)$/i.test(title)) {
    return null
  }

  return { title, startPage }
}

export function detectChapterHeading(line: string): string | null {
  const normalized = normalizeWhitespace(line)
  if (normalized.length < 4 || normalized.length > 140) return null

  // Match "Chapter 1: Intro" or "Chapter 1 Intro" or "Chap 1: Intro" or "Part 1: Intro"
  const chapterMatch = normalized.match(/^(chapter|chap|part|appendix)\s+([0-9ivxlcdm]+)\s*[:.\-\s]*\s*(.{3,120})$/i)
  if (chapterMatch?.[3]) {
    const type = chapterMatch[1].charAt(0).toUpperCase() + chapterMatch[1].slice(1).toLowerCase()
    return normalizeChapterTitle(`${type} ${chapterMatch[2].toUpperCase()}: ${chapterMatch[3]}`)
  }

  // Strict number match: "1 Introduction" (no dots, no brackets, starts with number, followed by space, then capital letter)
  const strictNumberedMatch = normalized.match(/^([0-9]+)\s+([A-Z][A-Za-z0-9 ,:'\-]{4,120})$/)
  if (strictNumberedMatch?.[2]) {
    // Avoid matching generic instructions or step-by-step lists
    const text = strictNumberedMatch[2]
    const isListOrStep = /^(step|figure|table|note|warning|exercise|quiz|page|version|project)\b/i.test(text)
    if (!isListOrStep) {
      return normalizeChapterTitle(`Chapter ${strictNumberedMatch[1]}: ${text}`)
    }
  }

  return null
}

export function detectChaptersFromPages(pages: LearningPage[]): ChapterMetadata[] {
  const candidates: Array<{ chapter: string; startPage: number }> = []

  // Prefer TOC entries first so we keep the book's own chapter labels when available.
  for (const page of pages.slice(0, Math.min(pages.length, 15))) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean)
    for (const line of lines) {
      const parsed = parseTocLine(line)
      if (parsed) {
        candidates.push({ chapter: parsed.title, startPage: parsed.startPage })
      }
    }
  }

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

  // Find back matter start page
  let backMatterStartPage: number | null = null
  const backMatterPatterns = [
    /^\s*index\s*$/i,
    /^\s*subject index\s*$/i,
    /^\s*author index\s*$/i,
    /^\s*bibliography\s*$/i,
    /^\s*references\s*$/i,
    /^\s*works cited\s*$/i,
  ]

  for (const page of pages) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean).slice(0, 5)
    const hasBackMatter = lines.some((line) => backMatterPatterns.some((pat) => pat.test(line)))
    if (hasBackMatter) {
      backMatterStartPage = page.pageNumber
      break
    }
  }

  const lastPageNum = pages[pages.length - 1]?.pageNumber || 1
  const contentEndPage = backMatterStartPage ? backMatterStartPage - 1 : lastPageNum

  return deduped.map((entry, index, items) => {
    const nextStart = items[index + 1]?.startPage
    const endPage = nextStart 
      ? nextStart - 1 
      : contentEndPage

    return {
      chapter: entry.chapter,
      startPage: entry.startPage,
      endPage: Math.max(entry.startPage, endPage),
    }
  })
}

export function chapterForPage(pageNumber: number, chapters: ChapterMetadata[]): string {
  return chapters.find((chapter) => pageNumber >= chapter.startPage && pageNumber <= chapter.endPage)?.chapter || "Uncategorized"
}
