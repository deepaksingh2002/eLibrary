import crypto from "crypto"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { DeckSchema, FlashcardDeck } from "./schema"

export interface FlashcardModel {
  withStructuredOutput?: (schema: unknown) => { invoke: (input: unknown) => Promise<unknown> }
  invoke: (input: unknown) => Promise<unknown>
}

export function normalizeEvidence(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function splitChapterText(text: string, targetWords = 2200): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const sections: string[] = []
  for (let index = 0; index < words.length; index += targetWords) {
    sections.push(words.slice(index, index + targetWords).join(" "))
  }
  return sections.filter(Boolean)
}

function dedupeCards(deck: FlashcardDeck): FlashcardDeck {
  const seen = new Set<string>()
  return {
    cards: deck.cards.filter((card) => {
      const key = normalizeEvidence(card.front).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  }
}

export async function generateFlashcardDeck(
  sections: string[],
  model: FlashcardModel,
  retries = 2,
): Promise<FlashcardDeck> {
  const cards: FlashcardDeck["cards"] = []
  for (const section of sections) {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const structured = model.withStructuredOutput
          ? model.withStructuredOutput(DeckSchema).invoke({ text: section })
          : model.invoke({ text: section })
        const parsed = DeckSchema.parse(await structured)
        const normalizedSource = normalizeEvidence(section)
        cards.push(...parsed.cards.filter((card) =>
          normalizedSource.includes(normalizeEvidence(card.evidence)),
        ))
        lastError = undefined
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) {
      throw new Error(`Flashcard section failed after ${retries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
    }
  }
  const result = dedupeCards({ cards })
  if (result.cards.length === 0) {
    throw new Error("Flashcard generation produced no source-grounded cards")
  }
  return DeckSchema.parse(result)
}

export function createFlashcardModel(): FlashcardModel {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set")
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: 0.1,
  }).withStructuredOutput(DeckSchema) as unknown as FlashcardModel
}

export function contentHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex")
}
