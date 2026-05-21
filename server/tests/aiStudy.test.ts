import { generateFlashcards } from "../src/services/aiStudyService"

// Mock the GoogleGenerativeAI module used by the service
jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: jest.fn(async (parts: any) => {
          return {
            response: {
              text: () => JSON.stringify({ flashcards: [
                { question: "What is X?", answer: "X is ..." },
                { question: "Define Y.", answer: "Y is ..." }
              ]})
            }
          }
        })
      }))
    }))
  }
})

// Provide a simple fetch mock (for getPdfPart)
global.fetch = jest.fn(async (url: any) => ({
  ok: true,
  headers: new Map([['content-length', '0']]),
  arrayBuffer: async () => new ArrayBuffer(0)
})) as any

describe('AI Study Service - flashcards', () => {
  const OLD = process.env.GEMINI_API_KEY
  beforeAll(() => { process.env.GEMINI_API_KEY = 'test' })
  afterAll(() => { process.env.GEMINI_API_KEY = OLD })

  test('generateFlashcards returns array of flashcards', async () => {
    const cards = await generateFlashcards({
      title: 'Test Book',
      author: 'Author',
      genre: 'Test',
      description: 'Desc',
      tags: [],
      pdfUrl: '',
      pdfPublicId: '',
    }, 5)

    expect(Array.isArray(cards)).toBe(true)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards[0]).toHaveProperty('question')
    expect(cards[0]).toHaveProperty('answer')
  })
})
