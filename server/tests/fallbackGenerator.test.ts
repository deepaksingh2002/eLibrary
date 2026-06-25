import { generateMCQ } from "../src/services/langchainPdfService";

describe('fallback MCQ generator', () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = 'test'
  })

  it('returns fallback MCQs and filters conversational/noisy content', async () => {
    const pdfText = [
      "This chapter provides a detailed explanation of binary search and why it halves the search space each step, describing invariants and loop conditions required to maintain correctness in iterative implementations.",
      "In an unrelated anecdote the narrative mentions a scenario about a stolen laptop which is not part of the technical material and should be ignored by academic quizzes.",
      "A paragraph describes a music shop selling guitars and stereo equipment but this story is incidental to the algorithmic content and should be filtered out by the extractor.",
      "The table of contents lists All chapters and overview material, which should not be used verbatim in question stems or topics.",
      "A key idea is that when you reduce the problem size by half each time, the overall complexity becomes logarithmic in the number of items, which the chapter demonstrates with examples.",
      "Another important point discusses boundary conditions and off-by-one errors when implementing loop-based binary search, which are common pitfalls for students.",
    ].join('\n\n')

    const res = await generateMCQ(pdfText, 'Test Book', 5)
    expect(res.questions.length).toBeGreaterThan(0)

    const banned = ['steal', 'guitar', 'stereo', 'all chapters']
    for (const q of res.questions) {
      for (const opt of Object.values(q.options)) {
        const low = (opt || '').toLowerCase()
        for (const b of banned) {
          expect(low).not.toContain(b)
        }
        expect((opt || '').length).toBeLessThanOrEqual(200)
      }
      // topic should not be 'All chapters' or similar
      expect((q.topic || '').toLowerCase()).not.toContain('all chapters')
    }
  }, 20000)
})
