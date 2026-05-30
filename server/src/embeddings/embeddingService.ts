import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"

const VECTOR_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"

export function getGeminiEmbeddings() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set")
  }

  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: VECTOR_MODEL,
  } as any)
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  const length = Math.min(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] || 0
    const rightValue = right[index] || 0
    dot += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }

  if (!leftMagnitude || !rightMagnitude) return 0
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}
