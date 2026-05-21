"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiStudyService_1 = require("../src/services/aiStudyService");
// Mock the GoogleGenerativeAI module used by the service
jest.mock("@google/generative-ai", () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn(() => ({
                generateContent: jest.fn(async (parts) => {
                    return {
                        response: {
                            text: () => JSON.stringify({ flashcards: [
                                    { question: "What is X?", answer: "X is ..." },
                                    { question: "Define Y.", answer: "Y is ..." }
                                ] })
                        }
                    };
                })
            }))
        }))
    };
});
// Provide a simple fetch mock (for getPdfPart)
global.fetch = jest.fn(async (url) => ({
    ok: true,
    headers: new Map([['content-length', '0']]),
    arrayBuffer: async () => new ArrayBuffer(0)
}));
describe('AI Study Service - flashcards', () => {
    const OLD = process.env.GEMINI_API_KEY;
    beforeAll(() => { process.env.GEMINI_API_KEY = 'test'; });
    afterAll(() => { process.env.GEMINI_API_KEY = OLD; });
    test('generateFlashcards returns array of flashcards', async () => {
        const cards = await (0, aiStudyService_1.generateFlashcards)({
            title: 'Test Book',
            author: 'Author',
            genre: 'Test',
            description: 'Desc',
            tags: [],
        }, 5);
        expect(Array.isArray(cards)).toBe(true);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards[0]).toHaveProperty('question');
        expect(cards[0]).toHaveProperty('answer');
    });
});
