import { z } from "zod"
import { ExtractedConcept } from "../types/aiLearning"
import { CONCEPT_EXTRACTION_SYSTEM_PROMPT, buildConceptExtractionPrompt } from "../prompts/mcqPrompts"
import { getGeminiJsonModel } from "../ai/geminiJsonModel"

const ConceptListSchema = z.object({
  concepts: z.array(z.object({
    name: z.string().min(2),
    definition: z.string().min(12),
    evidence: z.string().min(12),
  })),
})

function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim())
}

function normalizeConceptText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function isNoiseConceptText(value: string): boolean {
  return /\b(MEAP|Manning|copyright|ISBN|OCR|PDF|chapter\s+\d+|section\s+\d+|table of contents)\b/i.test(value)
}

function isLikelyConceptName(name: string): boolean {
  const normalized = normalizeConceptText(name)
  const wordCount = normalized.split(/\s+/).filter(Boolean).length

  if (wordCount < 1 || wordCount > 6) return false
  if (!/^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(normalized)) return false
  if (/^(?:in this book|this book|in this chapter|chapter|section|note|you may not remember|when i talk about)\b/i.test(normalized)) return false
  return !isNoiseConceptText(normalized)
}

function isLikelyConceptField(value: string): boolean {
  const normalized = normalizeConceptText(value)
  if (normalized.length < 12 || normalized.length > 260) return false
  if (isNoiseConceptText(normalized)) return false
  return true
}

export async function extractConceptsFromContext(params: {
  bookTitle: string
  chapterFocus?: string
  context: string
  maxConcepts?: number
}): Promise<ExtractedConcept[]> {
  if (!process.env.GEMINI_API_KEY) return []

  const model = getGeminiJsonModel({ maxTokens: 1400, temperature: 0 })
  const response = await model.invoke([
    ["system", CONCEPT_EXTRACTION_SYSTEM_PROMPT],
    ["human", buildConceptExtractionPrompt({
      bookTitle: params.bookTitle,
      chapterFocus: params.chapterFocus,
      context: params.context.slice(0, 18000),
      maxConcepts: params.maxConcepts || 12,
    })],
  ] as any)

  const parsed = ConceptListSchema.safeParse(parseJson(String(response.content || "")))
  if (!parsed.success) return []

  return parsed.data.concepts
    .map((concept) => ({
      name: normalizeConceptText(concept.name),
      definition: normalizeConceptText(concept.definition),
      evidence: normalizeConceptText(concept.evidence),
    }))
    .filter((concept) => isLikelyConceptName(concept.name))
    .filter((concept) => isLikelyConceptField(concept.definition))
    .filter((concept) => isLikelyConceptField(concept.evidence))
    .filter((concept) => !/\b(MEAP|Manning|copyright|ISBN|chapter|section)\b/i.test(`${concept.name} ${concept.definition} ${concept.evidence}`))
    .slice(0, params.maxConcepts || 12)
}
