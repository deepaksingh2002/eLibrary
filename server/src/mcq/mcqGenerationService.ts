import { ExtractedConcept, GeneratedMCQ } from "../types/aiLearning"
import { MCQ_GENERATION_SYSTEM_PROMPT, buildMcqGenerationPrompt } from "../prompts/mcqPrompts"
import { GeneratedMCQListSchema } from "../validators/mcqValidator"
import { getGeminiJsonModel } from "../ai/geminiJsonModel"
import { PromptTemplate } from "@langchain/core/prompts"

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim())
  } catch {
    return null
  }
}

/**
 * Remove leading headings or short question-like prefixes that commonly appear
 * at the top of OCRed chapter text (e.g. "Chapter 1:", "CHAPTER 1", or
 * "What is the key idea about Chapter 1:"). This helps avoid sending those
 * headings into the MCQ prompt where they can be incorrectly incorporated
 * into generated questions.
 */
function sanitizeChapterText(text: string): string {
  if (!text) return text
  let t = text.trim()

  // Remove a single leading line if it looks like a chapter heading
  const lines = t.split(/\r?\n/)
  if (lines.length > 1) {
    const first = lines[0].trim()

    // patterns that indicate a heading or short label
    const headingPattern = /^(chapter\b|ch\.?\b|part\b|section\b)\s*\d+/i
    const allCapsShort = /^[A-Z0-9\s'"-]{1,60}$/.test(first) && first.split(/\s+/).length <= 8
    const endsWithColon = /:$/.test(first)
    const questionPrefix = /^(what|why|how|which)\s+/i
    const prosePrefix = /^(talks about|describes|explains|shows|covers|introduces|examines|focuses on)\s+/i

    if (headingPattern.test(first) || (allCapsShort && endsWithColon) || questionPrefix.test(first) || prosePrefix.test(first)) {
      // drop the first line
      t = lines.slice(1).join("\n").trim()
    }
  }

  // Also remove repeated leading phrases like "Chapter 1: Chapter 1: ..."
  t = t.replace(/^(Chapter\s*\d+:\s*){2,}/i, "")
  t = t.replace(/^(Chapter\s*\d+:\s*)?(talks about|describes|explains|shows|covers|introduces|examines|focuses on)\s+/i, "$1")

  return t
}

type GeneratedMCQItem = {
  question_number: number
  concept_tested: string
  question_type: "conceptual" | "applied" | "comparison" | "numerical" | "why_purpose" | "consequence"
  question: string
  options: Record<"A" | "B" | "C" | "D", string>
  correct_answer: "A" | "B" | "C" | "D"
  explanation: string
}

function validateMCQs(mcqs: GeneratedMCQItem[]): boolean {
  const concepts = mcqs.map((question) => question.concept_tested.toLowerCase())
  const uniqueConcepts = new Set(concepts)
  if (uniqueConcepts.size < mcqs.length - 2) return false

  const allOptions = mcqs.flatMap((question) => Object.values(question.options))
  const uniqueOptions = new Set(allOptions)
  if (uniqueOptions.size < allOptions.length * 0.9) return false

  return true
}

function mapGeneratedQuestion(item: GeneratedMCQItem): GeneratedMCQ | null {
  const answerText = item.options[item.correct_answer]
  if (!answerText) return null

  return {
    question: item.question,
    options: [item.options.A, item.options.B, item.options.C, item.options.D],
    answer: answerText,
    explanation: item.explanation,
  }
}

function parseGeneratedMCQItems(text: string): GeneratedMCQItem[] | null {
  const parsed = parseJson(text)
  if (!Array.isArray(parsed)) return null

  const validation = GeneratedMCQListSchema.safeParse({
    questions: parsed.map((item) => ({
      question: item?.question,
      options: item?.options ? Object.values(item.options) : [],
      answer: item?.correct_answer ? String(item.correct_answer) : "",
      explanation: item?.explanation,
    })),
  })

  if (!validation.success) return null

  return parsed as GeneratedMCQItem[]
}

async function generateOnce(params: {
  model: ReturnType<typeof getGeminiJsonModel>
  chapterText: string
  count: number
}): Promise<GeneratedMCQ[] | null> {
  const prompt = PromptTemplate.fromTemplate(buildMcqGenerationPrompt())

  const humanPrompt = await prompt.format({
    num_questions: String(params.count),
    chapter_text: params.chapterText,
  })
  // Debug logging: record the exact prompts sent to the model for troubleshooting
  try {
    console.debug("[MCQ] System prompt:", MCQ_GENERATION_SYSTEM_PROMPT)
    // limit human prompt length in logs to avoid huge output
    console.debug("[MCQ] Human prompt (truncated 2000 chars):", humanPrompt.slice(0, 2000))
  } catch (e) {
    // ignore logging failures
  }

  const response = await params.model.invoke([
    ["system", MCQ_GENERATION_SYSTEM_PROMPT],
    ["human", humanPrompt],
  ] as any)

  const parsedItems = parseGeneratedMCQItems(String(response.content || ""))
  if (!parsedItems) return null
  if (!validateMCQs(parsedItems)) return null

  const questions = parsedItems
    .map((item) => mapGeneratedQuestion(item))
    .filter((question): question is GeneratedMCQ => Boolean(question))
    .slice(0, params.count)

  return questions.length > 0 ? questions : null
}

export async function generateMcqsFromConcepts(params: {
  bookTitle: string
  chapterFocus?: string
  concepts: ExtractedConcept[]
  count: number
  chapterText?: string
}): Promise<GeneratedMCQ[]> {
  if (!process.env.GEMINI_API_KEY || params.concepts.length === 0) return []

  const model = getGeminiJsonModel({ maxTokens: 3200, temperature: 0.15 })
  const chapterText = params.chapterText || params.concepts
    .map((concept) => `${concept.name}. ${concept.definition} ${concept.evidence}`)
    .join("\n\n")

  const sanitizedChapterText = sanitizeChapterText(chapterText)

  const firstAttempt = await generateOnce({
    model,
    chapterText: sanitizedChapterText,
    count: params.count,
  })

  if (firstAttempt) return firstAttempt

  const retryAttempt = await generateOnce({
    model,
    chapterText: sanitizedChapterText,
    count: params.count,
  })

  return retryAttempt ?? []
}
