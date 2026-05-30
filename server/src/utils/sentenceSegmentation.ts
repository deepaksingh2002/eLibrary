import { cleanupOcrText, normalizeWhitespace } from "./textCleanup"

function loadNaturalTokenizer(): any | null {
  try {
    const natural = require("natural")
    return natural?.SentenceTokenizer ? new natural.SentenceTokenizer() : null
  } catch {
    return null
  }
}

export function segmentSentences(text: string): string[] {
  const cleaned = cleanupOcrText(text)
  const tokenizer = loadNaturalTokenizer()
  const rawSentences: string[] = tokenizer
    ? tokenizer.tokenize(cleaned)
    : cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)

  return rawSentences
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 25)
    .filter((sentence) => /[A-Za-z]/.test(sentence))
    .filter((sentence) => !/\b(MEAP|Manning|copyright|ISBN)\b/i.test(sentence))
}

export function toSemanticParagraph(text: string): string {
  return segmentSentences(text).join("\n")
}
