import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const FALLBACK_EXPLANATION =
  "Readers who enjoy similar genres and authors have rated this book highly. " +
  "It shares key themes with books you have already enjoyed."

let cachedAvailability: {
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
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("[Gemini] GEMINI_API_KEY is not set")
      return FALLBACK_EXPLANATION
    }

    if (params.likedBooks.length === 0) {
      console.warn("[Gemini] No liked books available for context")
      return FALLBACK_EXPLANATION
    }

    const likedTitles = params.likedBooks
      .slice(0, 5)
      .map(b => `"${b.title}" by ${b.author}`)
      .join(", ")

    const prompt = `You are a library recommendation assistant.
A reader who enjoyed ${likedTitles} is being recommended
"${params.targetBook.title}" by ${params.targetBook.author}
(Genre: ${params.targetBook.genre}).

Write exactly 2 sentences explaining why this reader would enjoy
this book. Be specific, conversational, and reference what the
books have in common. Do not start with "I" or "This book".`

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7
      }
    })

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    if (!text) {
      console.warn("[Gemini] Empty response from API")
      return FALLBACK_EXPLANATION
    }

    console.log("[Gemini] Successfully generated explanation")
    return text

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Gemini] Explanation failed:", message)
    console.error("[Gemini] Full error:", error)
    return FALLBACK_EXPLANATION
  }
}

export async function isGeminiAvailable(): Promise<boolean> {
  if (
    cachedAvailability &&
    Date.now() - cachedAvailability.checkedAt < 300000
  ) {
    return cachedAvailability.available
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("[Gemini] GEMINI_API_KEY is not set")
      cachedAvailability = { available: false, checkedAt: Date.now() }
      return false
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 5 }
    })
    
    console.log("[Gemini] Availability check successful")
    cachedAvailability = { available: true, checkedAt: Date.now() }
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Gemini] Availability check failed:", message)
    cachedAvailability = { available: false, checkedAt: Date.now() }
    return false
  }
}
