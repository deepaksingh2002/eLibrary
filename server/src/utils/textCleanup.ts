const OCR_SYMBOL_MAP: Array<[RegExp, string]> = [
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/[–—]/g, "-"],
  [/[ﬁﬂ]/g, ""],
  [/[•·●]/g, " "],
  [/[^\S\r\n]+/g, " "],
]

const NOISE_PATTERNS = [
  /^\s*page\s+\d+\s*$/i,
  /^\s*\d+\s*$/i,
  /^\s*\d+\s*\/\s*\d+\s*$/i,
  /https?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\bisbn(?:-1[03])?\b/i,
  /\bcopyright\b/i,
  /\ball rights reserved\b/i,
  /\bmanning\b/i,
  /\bmeap\b/i,
  /\bmanning early access program\b/i,
  /\bpublisher'?s?\s+notes?\b/i,
  /\btable of contents\b/i,
]

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function stripBrokenOcrSymbols(text: string): string {
  return OCR_SYMBOL_MAP.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)
    .replace(/[|]{2,}/g, " ")
    .replace(/_{2,}/g, " ")
    .replace(/[=]{2,}/g, " ")
}

export function isNoiseLine(line: string): boolean {
  const normalized = normalizeWhitespace(line)
  if (!normalized) return true
  if (normalized.length <= 2 && !/[A-Za-z]/.test(normalized)) return true
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function cleanupOcrText(text: string): string {
  const normalized = stripBrokenOcrSymbols(text)
    .replace(/-\s*\n\s*/g, "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")

  const lines = normalized
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => !isNoiseLine(line))

  return lines
    .join("\n")
    .replace(/\b(MEAP Edition|Manning Early Access Program|Manning Publications?)\b/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bISBN(?:-1[03])?:?\s*[\d\-X]+\b/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function removeRepeatedPageLines<T extends { text: string }>(pages: T[]): T[] {
  const counts = new Map<string, number>()

  for (const page of pages) {
    const uniqueLines = new Set(
      page.text
        .split(/\n+/)
        .map((line) => normalizeWhitespace(line))
        .filter((line) => line.length > 0 && line.length <= 120),
    )

    for (const line of uniqueLines) {
      counts.set(line.toLowerCase(), (counts.get(line.toLowerCase()) || 0) + 1)
    }
  }

  const threshold = Math.max(2, Math.ceil(pages.length * 0.45))

  return pages.map((page) => ({
    ...page,
    text: page.text
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line && (counts.get(line.toLowerCase()) || 0) < threshold && !isNoiseLine(line))
      .join("\n")
      .trim(),
  }))
}

export function containsPublishingNoise(text: string): boolean {
  return /\b(MEAP|Manning|copyright|ISBN|publisher notes?|table of contents)\b/i.test(text)
}
