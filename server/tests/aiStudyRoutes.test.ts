import http from "http"
import jwt from "jsonwebtoken"

jest.mock("../src/models/Book", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}))

jest.mock("../src/models/AIStudyCache", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}))

jest.mock("../src/services/bookVectorService", () => ({
  __esModule: true,
  buildStudyContext: jest.fn().mockResolvedValue({
    success: false,
    text: "",
    pages: 0,
    chunksUsed: 0,
    error: "Vector context unavailable in test",
  }),
}))

jest.mock("../src/services/langchainPdfService", () => ({
  __esModule: true,
  loadBookPDFPages: jest.fn(),
  loadBookPDF: jest.fn(),
  generateSummary: jest.fn(),
  generateKeyPoints: jest.fn(),
  generateKeyPointsForChapter: jest.fn(),
  extractChapterIndexFromPages: jest.requireActual("../src/services/langchainPdfService").extractChapterIndexFromPages,
  extractChapterIndexFromPagesAsync: jest.requireActual("../src/services/langchainPdfService").extractChapterIndexFromPagesAsync,
  sanitizeChapterRanges: jest.requireActual("../src/services/langchainPdfService").sanitizeChapterRanges,
  resolveChapterRange: jest.requireActual("../src/services/langchainPdfService").resolveChapterRange,
  slicePagesForChapter: jest.requireActual("../src/services/langchainPdfService").slicePagesForChapter,
  generateMCQ: jest.fn(),
}))

import app from "../src/app"
import Book from "../src/models/Book"
import { loadBookPDFPages, generateMCQ } from "../src/services/langchainPdfService"

const bookId = "507f1f77bcf86cd799439011"

function createToken() {
  return jwt.sign({ id: "user-1", role: "admin" }, process.env.JWT_ACCESS_SECRET as string)
}

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

describe("AI study routes", () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = "test-secret"
    process.env.GEMINI_API_KEY = "test"
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Book.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: bookId,
          title: "Grokking Algorithms",
          author: "Aditya Bhargava",
          genre: "Algorithms",
          description: "",
          tags: [],
          pdfUrl: "https://example.com/book.pdf",
          extractionStatus: "ready",
          extractionError: "",
          extractedAt: new Date(),
        }),
      }),
    })
  })

  it("returns cleaned chapter titles from the chapter index endpoint", async () => {
    ;(loadBookPDFPages as jest.Mock).mockResolvedValue({
      success: true,
      totalPages: 3,
      pages: [
        {
          pageNumber: 1,
          text: [
            "Contents",
            "Chapter 1: Binary Search ................................ 3",
            "Chapter 2: Sorting ...................................... 19",
          ].join("\n"),
        },
        {
          pageNumber: 3,
          text: "Chapter 1: talks about binary search and shows how an algorithm halves the search space.",
        },
        {
          pageNumber: 19,
          text: "Chapter 2: describes sorting and compares selection sort with insertion sort.",
        },
      ],
      chapters: [],
      usedOcr: false,
    })

    const server = await startServer()
    try {
      const token = createToken()
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/ai-study/${bookId}/chapter-index`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(response.status).toBe(200)
      const payload = await response.json()
      const titles = payload.chapterIndex.chapters.map((chapter: { title: string }) => chapter.title.toLowerCase())

      expect(titles).toEqual(expect.arrayContaining(["binary search", "sorting"]))
      expect(titles.join(" ")).not.toContain("talks about")
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it("ignores noisy OCR chapter labels and falls back to the actual table of contents", async () => {
    ;(loadBookPDFPages as jest.Mock).mockResolvedValue({
      success: true,
      totalPages: 3,
      pages: [
        {
          pageNumber: 1,
          text: [
            "Contents",
            "Chapter 1: Binary Search ................................ 3",
            "Chapter 2: Sorting ...................................... 19",
          ].join("\n"),
        },
        {
          pageNumber: 3,
          text: "Chapter 1: talks about binary search and shows how an algorithm halves the search space.",
        },
        {
          pageNumber: 19,
          text: "Chapter 2: describes sorting and compares selection sort with insertion sort.",
        },
      ],
      chapters: [
        {
          chapter: "If you like making video games, you can write an A",
          startPage: 2,
          endPage: 2,
        },
        {
          chapter: "high = len(arr) -",
          startPage: 4,
          endPage: 4,
        },
      ],
      usedOcr: false,
    })

    const server = await startServer()
    try {
      const token = createToken()
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/ai-study/${bookId}/chapter-index`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(response.status).toBe(200)
      const payload = await response.json()
      const titles = payload.chapterIndex.chapters.map((chapter: { title: string }) => chapter.title.toLowerCase())

      expect(titles).toEqual(expect.arrayContaining(["binary search", "sorting"]))
      expect(titles.join(" ")).not.toContain("if you like making video games")
      expect(titles.join(" ")).not.toContain("len(arr)")
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it("returns full MCQ answer text through the mcq endpoint", async () => {
    ;(loadBookPDFPages as jest.Mock).mockResolvedValue({
      success: true,
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          text: "Chapter 1: Binary Search explains that the search space is halved after each comparison until the item is found.",
        },
      ],
      chapters: [],
      usedOcr: false,
    })

    ;(generateMCQ as jest.Mock).mockResolvedValue({
      questions: [
        {
          id: 1,
          question: "What does binary search do to the search space after each comparison?",
          options: {
            A: "It halves the search space after each comparison",
            B: "It doubles the search space after each comparison",
            C: "It leaves the search space unchanged",
            D: "It sorts the list on every step",
          },
          correct: "A",
          explanation: "Binary search halves the search space after each comparison.",
          topic: "binary search",
        },
      ],
      fallbackUsed: false,
    })

    const server = await startServer()
    try {
      const token = createToken()
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/ai-study/${bookId}/mcq?count=5`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(response.status).toBe(200)
      const payload = await response.json()
      expect(payload.questions).toHaveLength(1)
      expect(payload.questions[0].options.A).toBe("It halves the search space after each comparison")
      expect(JSON.stringify(payload.questions)).not.toContain("...")
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})