import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const FALLBACK_EXPLANATION =
  "Readers who enjoy similar genres and authors have rated this " +
  "book highly. It shares key themes with books you have already enjoyed."

let availabilityCache: {
  available: boolean
  checkedAt: number
} | null = null

export async function explainRecommendation(params: {
  targetBook: {
    title: string
    author: string
    genre: string
    tags: string[]
  }
  likedBooks: {
    title: string
    author: string
    genre: string
  }[]
  userName?: string
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[Gemini] GEMINI_API_KEY not set - using fallback")
    return FALLBACK_EXPLANATION
  }

  try {
    const likedTitles = params.likedBooks.length > 0
      ? params.likedBooks
        .slice(0, 5)
        .map(b => `"${b.title}" by ${b.author}`)
        .join(", ")
      : "highly rated books in related academic genres"

    const prompt = `You are a helpful library recommendation assistant.
A reader who enjoyed ${likedTitles} is being recommended
"${params.targetBook.title}" by ${params.targetBook.author}
(Genre: ${params.targetBook.genre}).

Write exactly 2 sentences explaining why this reader would enjoy
this book. Be specific, conversational, and reference what the
books have in common. Do not start with "I" or "This book".
Do not use any markdown formatting.`

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7,
        topP: 0.9
      }
    })

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    if (!text || text.length < 10) {
      console.warn("[Gemini] Empty response - using fallback")
      return FALLBACK_EXPLANATION
    }

    return text
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Gemini] explainRecommendation failed:", message)
    return FALLBACK_EXPLANATION
  }
}

export async function isGeminiAvailable(): Promise<boolean> {
  if (!process.env.GEMINI_API_KEY) return false

  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < 300_000
  ) {
    return availabilityCache.available
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"
    })
    await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 5 }
    })
    availabilityCache = { available: true, checkedAt: Date.now() }
    return true
  } catch {
    availabilityCache = { available: false, checkedAt: Date.now() }
    return false
  }
}
