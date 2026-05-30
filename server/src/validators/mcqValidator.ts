import { z } from "zod"
import { GeneratedMCQ } from "../types/aiLearning"
import { normalizeWhitespace } from "../utils/textCleanup"

export const GeneratedMCQSchema = z.object({
  question: z.string().min(20),
  options: z.array(z.string().min(1)).length(4),
  answer: z.string().min(1),
  explanation: z.string().min(20),
})

export const GeneratedMCQListSchema = z.object({
  questions: z.array(GeneratedMCQSchema),
})

const REJECT_PATTERNS = [
  /\bMEAP\b/i,
  /\bManning\b/i,
  /\bChapter\b/i,
  /\bIntroduction\b/i,
  /\bCopyright\b/i,
  /\bISBN\b/i,
  /\bsource text\b/i,
  /\bPDF\b/i,
  /\bOCR\b/i,
  /https?:\/\//i,
  /which statement best (captures|describes|explains|summarizes|reflects)/i,
  /which concept should a student understand most clearly/i,
  /as a professor/i,
  /what does .* explain about/i,
  /role of .* chapter/i,
  /selected chapter/i,
  /provided context/i,
  /extracted concept/i,
]

const REJECT_GENERIC_STEMS = [
  /^which statement best/i,
  /^which of the following/i,
  /^what is the role of/i,
  /^what does .* mean/i,
  /^what does .* tell you/i,
  /^which option best/i,
]

export function validateGeneratedMCQ(input: unknown): GeneratedMCQ | null {
  const parsed = GeneratedMCQSchema.safeParse(input)
  if (!parsed.success) return null

  const question = normalizeWhitespace(parsed.data.question)
  const options = parsed.data.options.map((option) => normalizeWhitespace(option))
  const answer = normalizeWhitespace(parsed.data.answer)
  const explanation = normalizeWhitespace(parsed.data.explanation)
  const joined = [question, ...options, answer, explanation].join(" ")

  if (REJECT_PATTERNS.some((pattern) => pattern.test(joined))) return null
  if (REJECT_GENERIC_STEMS.some((pattern) => pattern.test(question))) return null
  if (!/[?]$/.test(question)) return null
  if (question.split(/\s+/).length < 6) return null
  if (question.length > 180) return null
  if (/[^\x20-\x7E]/.test(question)) return null
  if (/\s[,.!?;:]/.test(question)) return null
  if (/(.)\1{4,}/.test(joined)) return null
  if (new Set(options.map((option) => option.toLowerCase())).size !== 4) return null
  if (!options.some((option) => option.toLowerCase() === answer.toLowerCase())) return null
  if (options.some((option) => option.length < 3 || option.length > 220)) return null
  if (/[.?!,:;]$/.test(question.replace(/[?]$/, ""))) return null

  return { question, options, answer, explanation }
}

export function lexicalQuestionKey(question: string): string {
  return normalizeWhitespace(question)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => !["what", "which", "why", "how", "does", "best", "most", "following"].includes(word))
    .join(" ")
}
