import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

export function getGeminiJsonModel(params: {
  maxTokens: number
  temperature?: number
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set")
  }

  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: params.temperature ?? 0,
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: params.maxTokens,
  } as any)
}