import { GeneratedMCQ, StudyMCQQuestion } from "../types/aiLearning"
import { extractConceptsFromContext } from "./conceptExtractionService"
import { generateMcqsFromConcepts } from "./mcqGenerationService"
import { removeDuplicateQuestions } from "./deduplicationService"

function toStudyQuestion(question: GeneratedMCQ, index: number, topic: string): StudyMCQQuestion {
  const correctIndex = question.options.findIndex((option) => option.toLowerCase() === question.answer.toLowerCase())
  const correct = (["A", "B", "C", "D"][correctIndex >= 0 ? correctIndex : 0] || "A") as "A" | "B" | "C" | "D"

  return {
    id: index + 1,
    question: question.question,
    options: {
      A: question.options[0],
      B: question.options[1],
      C: question.options[2],
      D: question.options[3],
    },
    correct,
    explanation: question.explanation,
    topic,
  }
}

export async function generateProductionMCQs(params: {
  context: string
  bookTitle: string
  count: number
  chapterFocus?: string
}): Promise<StudyMCQQuestion[]> {
  const concepts = await extractConceptsFromContext({
    bookTitle: params.bookTitle,
    chapterFocus: params.chapterFocus,
    context: params.context,
    maxConcepts: Math.max(8, params.count * 2),
  })

  if (concepts.length === 0) return []

  const generated = await generateMcqsFromConcepts({
    bookTitle: params.bookTitle,
    chapterFocus: params.chapterFocus,
    concepts,
    count: params.count,
    chapterText: params.context,
  })

  const unique = await removeDuplicateQuestions(generated, 0.85)
  return unique.slice(0, params.count).map((question, index) => toStudyQuestion(
    question,
    index,
    concepts[index % concepts.length]?.name || params.chapterFocus || "Concept",
  ))
}
