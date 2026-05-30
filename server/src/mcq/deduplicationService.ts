import { getGeminiEmbeddings, cosineSimilarity } from "../embeddings/embeddingService"
import { GeneratedMCQ } from "../types/aiLearning"
import { lexicalQuestionKey } from "../validators/mcqValidator"

export async function removeDuplicateQuestions(
  questions: GeneratedMCQ[],
  threshold = 0.85,
): Promise<GeneratedMCQ[]> {
  const lexicalKeys = new Set<string>()
  const lexicalUnique = questions.filter((question) => {
    const key = lexicalQuestionKey(question.question)
    if (!key || lexicalKeys.has(key)) return false
    lexicalKeys.add(key)
    return true
  })

  if (lexicalUnique.length <= 1 || !process.env.GEMINI_API_KEY) {
    return lexicalUnique
  }

  try {
    const embeddings = getGeminiEmbeddings()
    const vectors = await embeddings.embedDocuments(lexicalUnique.map((question) => question.question))
    const accepted: GeneratedMCQ[] = []
    const acceptedVectors: number[][] = []

    for (let index = 0; index < lexicalUnique.length; index += 1) {
      const vector = vectors[index] || []
      const duplicate = acceptedVectors.some((acceptedVector) => cosineSimilarity(vector, acceptedVector) > threshold)
      if (!duplicate) {
        accepted.push(lexicalUnique[index])
        acceptedVectors.push(vector)
      }
    }

    return accepted
  } catch (error) {
    console.warn("[MCQDeduplication] Embedding duplicate check failed:", error instanceof Error ? error.message : String(error))
    return lexicalUnique
  }
}
