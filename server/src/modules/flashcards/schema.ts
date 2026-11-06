import { z } from "zod"

export const CardSchema = z.object({
  front: z.string().min(10).max(200),
  back: z.string().min(1).max(300),
  evidence: z.string().min(20),
  difficulty: z.enum(["easy", "medium", "hard"]),
})

export const DeckSchema = z.object({
  cards: z.array(CardSchema).min(1).max(20),
})

export type Flashcard = z.infer<typeof CardSchema>
export type FlashcardDeck = z.infer<typeof DeckSchema>
