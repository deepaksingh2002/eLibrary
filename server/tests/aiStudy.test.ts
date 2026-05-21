import {
  generateBookSummary,
  generateMCQQuestions,
  generateKeyPoints,
  type BookForAI,
} from "../src/services/aiStudyService";

const TEST_BOOK: BookForAI = {
  _id: "book-1",
  title: "Test Book",
  author: "Author",
  genre: "Test",
  description: "Desc",
  tags: [],
  pdfUrl: "",
  geminiFileUri: "",
  geminiMimeType: "application/pdf",
  extractionStatus: "pending",
};

describe("AI Study Service fallbacks", () => {
  const oldGeminiApiKey = process.env.GEMINI_API_KEY;

  beforeAll(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = oldGeminiApiKey;
  });

  test("generateBookSummary returns fallback when GEMINI_API_KEY is missing", async () => {
    const summary = await generateBookSummary(TEST_BOOK);

    expect(summary.basedOnPDF).toBe(false);
    expect(summary.overview).toContain("GEMINI_API_KEY not configured");
  });

  test("generateMCQQuestions returns empty array when GEMINI_API_KEY is missing", async () => {
    const questions = await generateMCQQuestions(TEST_BOOK, 5);

    expect(Array.isArray(questions)).toBe(true);
    expect(questions).toHaveLength(0);
  });

  test("generateKeyPoints returns fallback when GEMINI_API_KEY is missing", async () => {
    const keyPoints = await generateKeyPoints(TEST_BOOK);

    expect(keyPoints.basedOnPDF).toBe(false);
    expect(keyPoints.chapters[0]?.title).toBe("Pending");
  });
});
