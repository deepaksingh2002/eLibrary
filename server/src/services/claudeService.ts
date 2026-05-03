import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const FALLBACK_EXPLANATION =
  "Readers who enjoy similar genres and authors have rated this " +
  "book highly. It shares key themes with books you have already enjoyed."

const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024

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

export async function summarizePdfBook(params: {
  title: string
  author: string
  genre: string
  description?: string
  tags?: string[]
  pdfUrl?: string
}): Promise<{
  summary: string
  keyPoints: string[]
  isAIGenerated: boolean
}> {
  const fallbackSummary =
    params.description?.trim() ||
    `${params.title} by ${params.author} is a ${params.genre} book. ` +
      "A full AI PDF summary is not available right now."

  const fallback = {
    summary: fallbackSummary,
    keyPoints: [
      `Title: ${params.title}`,
      `Author: ${params.author}`,
      `Genre: ${params.genre}`
    ],
    isAIGenerated: false
  }

  if (!process.env.GEMINI_API_KEY || !params.pdfUrl) {
    return fallback
  }

  try {
    const pdfResponse = await fetch(params.pdfUrl)
    if (!pdfResponse.ok) {
      console.error("[Gemini] PDF fetch failed:", pdfResponse.status, pdfResponse.statusText)
      return fallback
    }

    const contentLength = Number(pdfResponse.headers.get("content-length") || 0)
    if (contentLength > MAX_INLINE_PDF_BYTES) {
      console.warn("[Gemini] PDF too large for inline summary - using fallback")
      return fallback
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
    if (pdfBuffer.byteLength > MAX_INLINE_PDF_BYTES) {
      console.warn("[Gemini] PDF too large after download - using fallback")
      return fallback
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 700,
        temperature: 0.3,
        topP: 0.9
      }
    })

    const prompt = `Summarize this PDF book for an eLibrary reader.
Book metadata:
Title: ${params.title}
Author: ${params.author}
Genre: ${params.genre}
Tags: ${(params.tags || []).join(", ") || "none"}

Return valid JSON only with this shape:
{
  "summary": "A clear 2 to 4 paragraph summary of the PDF content.",
  "keyPoints": ["5 concise bullet points about the most important ideas"]
}

Do not use markdown fences.`

    const result = await model.generateContent([
      {
        inlineData: {
          data: pdfBuffer.toString("base64"),
          mimeType: "application/pdf"
        }
      },
      { text: prompt }
    ])

    const raw = result.response.text().trim()
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
    const parsed = JSON.parse(cleaned) as { summary?: string; keyPoints?: string[] }

    if (!parsed.summary || !Array.isArray(parsed.keyPoints)) {
      return fallback
    }

    return {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints.slice(0, 7),
      isAIGenerated: true
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[Gemini] summarizePdfBook failed:", message)
    return fallback
  }
}
