import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
)

export interface BookSummary {
  overview: string
  keyThemes: string[]
  targetReader: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  estimatedTime: string
}

export interface MCQQuestion {
  id: number
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
}

export interface KeyPoints {
  chapters: { title: string; points: string[] }[]
  glossary: { term: string; definition: string }[]
  takeaways: string[]
}

interface BookContext {
  title: string
  author: string
  genre: string
  description: string
  tags: string[]
}

const FALLBACK_SUMMARY: BookSummary = {
  overview:
    "Summary generation is temporarily unavailable. Please try again later.",
  keyThemes: ["Content analysis unavailable"],
  targetReader: "Information not available",
  difficulty: "Intermediate",
  estimatedTime: "Unknown"
}

const FALLBACK_KEY_POINTS: KeyPoints = {
  chapters: [
    {
      title: "Key Points",
      points: ["Key points extraction is temporarily unavailable."]
    }
  ],
  glossary: [],
  takeaways: ["Please try again later."]
}

export async function generateBookSummary(
  book: BookContext
): Promise<BookSummary> {
  if (!process.env.GEMINI_API_KEY) return FALLBACK_SUMMARY

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.4,
        responseMimeType: "application/json"
      }
    })

    const prompt = `You are an academic librarian and book expert.
Analyze this book and provide a structured summary for students.
Return ONLY valid JSON with no markdown.

Book Information:
  Title:       ${book.title}
  Author:      ${book.author}
  Genre:       ${book.genre}
  Description: ${book.description?.slice(0, 800) || "Not provided"}
  Topics/Tags: ${book.tags.join(", ") || "Not provided"}

Return this exact JSON structure:
{
  "overview": "3-4 sentence comprehensive overview of the book's content, purpose and value",
  "keyThemes": ["theme 1", "theme 2", "theme 3", "theme 4", "theme 5"],
  "targetReader": "One sentence describing who would benefit most from reading this book",
  "difficulty": "Beginner or Intermediate or Advanced",
  "estimatedTime": "Estimated reading time like '6-8 hours' or '10-12 hours'"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(clean)

    return {
      overview: parsed.overview || FALLBACK_SUMMARY.overview,
      keyThemes: Array.isArray(parsed.keyThemes)
        ? parsed.keyThemes.slice(0, 6)
        : FALLBACK_SUMMARY.keyThemes,
      targetReader: parsed.targetReader || "",
      difficulty: ["Beginner", "Intermediate", "Advanced"].includes(parsed.difficulty)
        ? parsed.difficulty
        : "Intermediate",
      estimatedTime: parsed.estimatedTime || ""
    }
  } catch (err) {
    return FALLBACK_SUMMARY
  }
}

export async function generateMCQQuestions(book: BookContext, count = 10): Promise<MCQQuestion[]> {
  if (!process.env.GEMINI_API_KEY) return []

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 1800,
        temperature: 0.5,
        responseMimeType: "application/json"
      }
    })

    const prompt = `Generate ${count} MCQ questions for: "${book.title}" by ${book.author}
Genre: ${book.genre} | Tags: ${book.tags.slice(0, 2).join(", ")}
Desc: ${book.description?.slice(0, 400) || ""}
Return JSON only: {"questions":[{"id":1,"question":"?","options":{"A":"","B":"","C":"","D":""},"correct":"A","explanation":""}]}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(clean)

    const questions: MCQQuestion[] = (parsed.questions || [])
      .slice(0, count)
      .map((q: any, i: number) => ({
        id: i + 1,
        question: q.question || "",
        options: {
          A: q.options?.A || "",
          B: q.options?.B || "",
          C: q.options?.C || "",
          D: q.options?.D || ""
        },
        correct: ["A", "B", "C", "D"].includes(q.correct) ? q.correct : "A",
        explanation: q.explanation || ""
      }))
      .filter((q: MCQQuestion) => q.question && q.options.A)

    return questions
  } catch (err) {
    return []
  }
}

export async function generateKeyPoints(book: BookContext): Promise<KeyPoints> {
  if (!process.env.GEMINI_API_KEY) return FALLBACK_KEY_POINTS

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })

    const prompt = `Extract key learning points from: "${book.title}" by ${book.author}
Genre: ${book.genre}. Description: ${book.description?.slice(0, 300) || ""}
Return JSON: {"chapters":[{"title":"Main Ideas","points":["key1","key2"]}],"glossary":[{"term":"t","definition":"d"}],"takeaways":["insight1"]}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(clean)

    return {
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.slice(0, 6).map((c: Record<string, unknown>) => ({
            title: String(c.title || "Section"),
            points: Array.isArray(c.points) ? c.points.slice(0, 5).map(String) : []
          }))
        : FALLBACK_KEY_POINTS.chapters,
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary.slice(0, 10).map((g: Record<string, unknown>) => ({
            term: String(g.term || ""),
            definition: String(g.definition || "")
          }))
        : [],
      takeaways: Array.isArray(parsed.takeaways)
        ? parsed.takeaways.slice(0, 5).map(String)
        : FALLBACK_KEY_POINTS.takeaways
    }
  } catch (err) {
    return FALLBACK_KEY_POINTS
  }
}

export default {
  generateBookSummary,
  generateMCQQuestions,
  generateKeyPoints
}
