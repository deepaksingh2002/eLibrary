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

  const firstAttempt = await generateOnce({
    model,
    chapterText,
    count: params.count,
  })

  if (firstAttempt) return firstAttempt

  const retryAttempt = await generateOnce({
    model,
    chapterText,
    count: params.count,
  })

  return retryAttempt ?? []
}
