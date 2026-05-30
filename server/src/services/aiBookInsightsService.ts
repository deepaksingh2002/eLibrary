import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { processBookPdf } from "./pdfPipelineService";

const FALLBACK_EXPLANATION =
  "Readers who enjoy similar genres and authors have rated this " +
  "book highly. It shares key themes with books you have already enjoyed.";

const MAX_SUMMARY_CONTEXT_CHARS = 18_000;

let availabilityCache: {
  available: boolean;
  checkedAt: number;
} | null = null;

function getGeminiModel(params: { maxTokens: number; temperature: number }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: params.temperature,
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: params.maxTokens,
  } as any);
}

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

function getMessageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return String(content || "").trim();

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("\n")
    .trim();
}

export async function generateRecommendationExplanation(params: {
  targetBook: {
    title: string;
    author: string;
    genre: string;
    tags: string[];
  };
  likedBooks: {
    title: string;
    author: string;
    genre: string;
  }[];
  userName?: string;
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI] GEMINI_API_KEY not set - using fallback");
    return FALLBACK_EXPLANATION;
  }

  try {
    const likedTitles =
      params.likedBooks.length > 0
        ? params.likedBooks
            .slice(0, 5)
            .map((b) => `"${b.title}" by ${b.author}`)
            .join(", ")
        : "highly rated books in related academic genres";

    const prompt = `You are a helpful library recommendation assistant.
A reader who enjoyed ${likedTitles} is being recommended
"${params.targetBook.title}" by ${params.targetBook.author}
(Genre: ${params.targetBook.genre}).

Write exactly 2 sentences explaining why this reader would enjoy
this book. Be specific, conversational, and reference what the
books have in common. Do not start with "I" or "This book".
Do not use any markdown formatting.`;

    const model = getGeminiModel({ maxTokens: 150, temperature: 0.7 });
    const response = await model.invoke([
      ["system", "You are a helpful library recommendation assistant."],
      ["human", prompt],
    ] as any);
    const text = getMessageText(response.content);

    if (!text || text.length < 10) {
      console.warn("[AI] Empty response - using fallback");
      return FALLBACK_EXPLANATION;
    }

    return text;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI] explainRecommendation failed:", message);
    return FALLBACK_EXPLANATION;
  }
}

export async function isAIServiceAvailable(): Promise<boolean> {
  if (!process.env.GEMINI_API_KEY) return false;

  if (availabilityCache && Date.now() - availabilityCache.checkedAt < 300_000) {
    return availabilityCache.available;
  }

  try {
    const model = getGeminiModel({ maxTokens: 5, temperature: 0 });
    await model.invoke([["human", "ping"]] as any);
    availabilityCache = { available: true, checkedAt: Date.now() };
    return true;
  } catch {
    availabilityCache = { available: false, checkedAt: Date.now() };
    return false;
  }
}

export async function summarizeBookWithAIInsights(params: {
  title: string;
  author: string;
  genre: string;
  description?: string;
  tags?: string[];
  pdfUrl?: string;
}): Promise<{
  summary: string;
  keyPoints: string[];
  isAIGenerated: boolean;
}> {
  const fallbackSummary =
    params.description?.trim() ||
    `${params.title} by ${params.author} is a ${params.genre} book. ` +
      "A full AI PDF summary is not available right now.";

  const fallback = {
    summary: fallbackSummary,
    keyPoints: [
      `Title: ${params.title}`,
      `Author: ${params.author}`,
      `Genre: ${params.genre}`,
    ],
    isAIGenerated: false,
  };

  if (!process.env.GEMINI_API_KEY || !params.pdfUrl) {
    return fallback;
  }

  try {
    const pdfResult = await processBookPdf(
      params.pdfUrl,
      `${params.title}-${params.author}`,
    );

    if (!pdfResult.success || !pdfResult.text.trim()) {
      console.error("[AI] PDF extraction failed:", pdfResult.error || "No text");
      return fallback;
    }

    const model = getGeminiModel({ maxTokens: 900, temperature: 0.2 });
    const context = pdfResult.text.slice(0, MAX_SUMMARY_CONTEXT_CHARS);

    const prompt = `Summarize this book for an eLibrary reader using the extracted PDF text.
Book metadata:
Title: ${params.title}
Author: ${params.author}
Genre: ${params.genre}
Tags: ${(params.tags || []).join(", ") || "none"}
PDF extraction mode: ${pdfResult.source}${pdfResult.usedOcr ? " (OCR)" : ""}

Return valid JSON only with this shape:
{
  "summary": "A clear 2 to 4 paragraph summary grounded in the PDF content.",
  "keyPoints": ["5 concise bullet points about the most important ideas"]
}

Rules:
- Base your answer only on the provided metadata and extracted PDF text.
- Do not invent facts that are not in the extracted text.
- Do not use markdown fences.

Extracted PDF text:
${context}`;

    const response = await model.invoke([
      ["system", "You summarize books accurately and return strict JSON output."],
      ["human", prompt],
    ] as any);

    const parsed = parseJsonResponse<{
      summary?: string;
      keyPoints?: string[];
    }>(getMessageText(response.content));

    if (!parsed.summary || !Array.isArray(parsed.keyPoints)) {
      return fallback;
    }

    return {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints.slice(0, 7),
      isAIGenerated: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI] summarizePdfBook failed:", message);
    return fallback;
  }
}

export async function summarizeReaderOpinions(params: {
  title: string;
  author: string;
  genre: string;
  tags?: string[];
}): Promise<{
  readerNotes: string[];
  isAIGenerated: boolean;
}> {
  const fallbackNotes = [
    `Readers who enjoy ${params.genre.toLowerCase()} books tend to mention ${params.title} for its practical themes and clear structure.`,
    `People often compare it with similar ${params.genre.toLowerCase()} titles by ${params.author} and other authors in the same space.`,
    `If you like focused, easy-to-follow books in this topic, reader sentiment is usually positive for this title.`,
  ];

  if (!process.env.GEMINI_API_KEY) {
    return { readerNotes: fallbackNotes, isAIGenerated: false };
  }

  try {
    const model = getGeminiModel({ maxTokens: 250, temperature: 0.3 });

    const prompt = `Create likely reader sentiment notes for the book "${params.title}" by ${params.author}.

Book metadata:
- Genre: ${params.genre}
- Tags: ${(params.tags || []).join(", ") || "none"}

Return valid JSON only with this shape:
{
  "readerNotes": [
    "Short note about what readers generally like about the book.",
    "Short note about common praise or usefulness.",
    "Short note about any repeated caveat or mixed opinion."
  ]
}

Rules:
- Keep each note under 25 words.
- Keep wording general and avoid fabricated specific review claims.
- Do not quote reviews.
- Do not include markdown fences.`;

    const response = await model.invoke([
      ["system", "You produce concise, neutral sentiment summaries from book metadata."],
      ["human", prompt],
    ] as any);

    const parsed = parseJsonResponse<{ readerNotes?: unknown }>(
      getMessageText(response.content),
    );
    const readerNotes = Array.isArray(parsed.readerNotes)
      ? parsed.readerNotes
          .map((note) => (typeof note === "string" ? note.trim() : ""))
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (!readerNotes.length) {
      return { readerNotes: fallbackNotes, isAIGenerated: false };
    }

    return { readerNotes, isAIGenerated: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI] summarizeReaderOpinions failed:", message);
    return { readerNotes: fallbackNotes, isAIGenerated: false };
  }
}
