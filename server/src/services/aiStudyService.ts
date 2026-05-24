import { generateFromPdfWithLangChain } from "./langchainPdfService";

// ─── Types ────────────────────────────────────────────────

export interface BookSummary {
  overview: string;
  keyThemes: string[];
  targetReader: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  basedOnPDF: boolean;
}

export interface MCQQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  topic: string;
}

export interface KeyPoints {
  chapters: {
    title: string;
    points: string[];
  }[];
  glossary: {
    term: string;
    definition: string;
  }[];
  takeaways: string[];
  examTips: string[];
  interviewTopics: string[];
  basedOnPDF: boolean;
}

export interface BookForAI {
  _id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  tags: string[];
  pdfUrl: string;
  extractionStatus: string;
}

// ─── Safe JSON parser ─────────────────────────────────────
function parseJSON(text: string): any {
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(clean);
}

// ─── Fallback responses ───────────────────────────────────
const FALLBACK_SUMMARY: BookSummary = {
  overview:
    "This book's PDF has not been processed yet. Please wait a few minutes after uploading, or ask an admin to check the PDF status.",
  keyThemes: ["PDF processing pending"],
  targetReader: "Unavailable",
  difficulty: "Intermediate",
  estimatedTime: "Unknown",
  basedOnPDF: false,
};

const FALLBACK_KEY_POINTS: KeyPoints = {
  chapters: [{ title: "Pending", points: ["PDF not yet processed"] }],
  glossary: [],
  takeaways: [],
  examTips: [],
  interviewTopics: [],
  basedOnPDF: false,
};

// ─────────────────────────────────────────────────────────
// GENERATE BOOK SUMMARY
// AI pipeline reads the actual PDF and summarizes it
// ─────────────────────────────────────────────────────────
export async function generateBookSummary(
  book: BookForAI,
): Promise<BookSummary> {
  if (!book.pdfUrl) {
    return {
      ...FALLBACK_SUMMARY,
      overview: "No PDF is available for this book.",
    };
  }

  const prompt = `You are an expert academic librarian.
Read this PDF book carefully and provide a structured summary.
Return ONLY valid JSON — no markdown, no extra text.

{
  "overview": "3-4 sentences describing the book's actual content, main topics, and purpose. Be specific — reference actual topics and concepts you see in the PDF.",
  "keyThemes": [
    "Specific theme from the actual book content",
    "Second theme",
    "Third theme",
    "Fourth theme",
    "Fifth theme"
  ],
  "targetReader": "One sentence: who benefits most from this book based on its actual content and level",
  "difficulty": "Beginner or Intermediate or Advanced",
  "estimatedTime": "Estimated reading time based on actual book length"
}

Be specific to the actual PDF content.
Do not give generic answers based on the book title.`;

  const result = await generateFromPdfWithLangChain({
    pdfUrl: book.pdfUrl,
    title: book.title,
    prompt,
    maxOutputTokens: 800,
  });

  if (!result.success || !result.text) {
    console.error("[AIStudy] Summary generation failed:", result.error, result.text?.slice?.(0,500));
    return FALLBACK_SUMMARY;
  }

  try {
    const parsed = parseJSON(result.text);
    return {
      overview: parsed.overview || FALLBACK_SUMMARY.overview,
      keyThemes: Array.isArray(parsed.keyThemes)
        ? parsed.keyThemes.slice(0, 6)
        : FALLBACK_SUMMARY.keyThemes,
      targetReader: parsed.targetReader || "",
      difficulty: ["Beginner", "Intermediate", "Advanced"].includes(
        parsed.difficulty,
      )
        ? parsed.difficulty
        : "Intermediate",
      estimatedTime: parsed.estimatedTime || "",
      basedOnPDF: true,
    };
  } catch (err: any) {
    console.error("[AIStudy] Summary parse error:", err.message);
    return FALLBACK_SUMMARY;
  }
}

// ─────────────────────────────────────────────────────────
// GENERATE MCQ QUESTIONS
// AI pipeline reads the PDF and creates questions from it
// ─────────────────────────────────────────────────────────
export async function generateMCQQuestions(
  book: BookForAI,
  count = 10,
): Promise<MCQQuestion[]> {
  if (!book.pdfUrl) {
    console.error("[AIStudy] No PDF URL for MCQ generation");
    return [];
  }

  const prompt = `You are an expert academic quiz creator.
Read this PDF carefully and create exactly ${count} multiple-choice
questions based on its actual content.

Return ONLY valid JSON — no markdown:
{
  "questions": [
    {
      "id": 1,
      "question": "Question about specific content in this PDF?",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correct": "A",
      "explanation": "Why this answer is correct based on the PDF content",
      "topic": "Chapter or section this question comes from"
    }
  ]
}`;

  const result = await generateFromPdfWithLangChain({
    pdfUrl: book.pdfUrl,
    title: book.title,
    prompt,
    maxOutputTokens: 3000,
  });

  if (!result.success || !result.text) {
    console.error("[AIStudy] MCQ generation failed:", result.error, result.text?.slice?.(0,500));
    return [];
  }

  try {
    const parsed = parseJSON(result.text);
    if ((!parsed.questions || parsed.questions.length === 0)) {
      console.warn('[AIStudy] MCQ parsed but no questions:', { parsedSample: result.text?.slice?.(0,500) });
    }
    return (parsed.questions || [])
      .slice(0, count)
      .map((q: any, i: number) => ({
        id: i + 1,
        question: q.question || "",
        options: {
          A: q.options?.A || "",
          B: q.options?.B || "",
          C: q.options?.C || "",
          D: q.options?.D || "",
        },
        correct: ["A", "B", "C", "D"].includes(q.correct) ? q.correct : "A",
        explanation: q.explanation || "",
        topic: q.topic || "General",
      }))
      .filter((q: MCQQuestion) => q.question && q.question.length > 5);
  } catch (err: any) {
    console.error("[AIStudy] MCQ parse error:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// GENERATE KEY POINTS + EXAM TIPS + INTERVIEW TOPICS
// ─────────────────────────────────────────────────────────
export async function generateKeyPoints(book: BookForAI): Promise<KeyPoints> {
  if (!book.pdfUrl) {
    console.error("[AIStudy] No PDF URL for key points");
    return FALLBACK_KEY_POINTS;
  }

  const prompt = `You are an expert academic tutor.
Read this PDF book carefully and extract the most important
learning content for students preparing for exams and interviews.

Return ONLY valid JSON — no markdown:
{
  "chapters": [
    {
      "title": "Actual chapter name from the PDF",
      "points": [
        "Key concept or fact from this chapter",
        "Another important point from this chapter",
        "Third key point"
      ]
    }
  ],
  "glossary": [
    {
      "term": "Technical term from the PDF",
      "definition": "How this term is defined or used in the PDF"
    }
  ],
  "takeaways": [
    "Practical insight from this book's actual content",
    "Second takeaway",
    "Third takeaway",
    "Fourth takeaway",
    "Fifth takeaway"
  ],
  "examTips": [
    "Specific fact/formula/concept from PDF likely in exams",
    "Second exam topic from PDF",
    "Third exam topic",
    "Fourth exam topic",
    "Fifth exam topic"
  ],
  "interviewTopics": [
    "Technical concept from PDF commonly asked in interviews",
    "Second interview topic from PDF",
    "Third interview concept",
    "Fourth interview topic",
    "Fifth interview topic"
  ]
}

Requirements:
- chapters: 4-6 sections matching actual PDF structure
- glossary: 8-15 terms that actually appear in the PDF
- examTips: specific memorizable facts, formulas, algorithms from PDF
- interviewTopics: conceptual understanding questions about this subject
- ALL content must come from the actual PDF not general knowledge`;

  const result = await generateFromPdfWithLangChain({
    pdfUrl: book.pdfUrl,
    title: book.title,
    prompt,
    maxOutputTokens: 2500,
  });

  if (!result.success || !result.text) {
    console.error("[AIStudy] Key points failed:", result.error);
    return FALLBACK_KEY_POINTS;
  }

  try {
    const parsed = parseJSON(result.text);
    return {
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.slice(0, 8).map((c: any) => ({
            title: c.title || "Section",
            points: Array.isArray(c.points) ? c.points.slice(0, 5) : [],
          }))
        : FALLBACK_KEY_POINTS.chapters,
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary
            .slice(0, 15)
            .map((g: any) => ({
              term: g.term || "",
              definition: g.definition || "",
            }))
            .filter((g: any) => g.term && g.definition)
        : [],
      takeaways: Array.isArray(parsed.takeaways)
        ? parsed.takeaways.slice(0, 6)
        : [],
      examTips: Array.isArray(parsed.examTips)
        ? parsed.examTips.slice(0, 8)
        : [],
      interviewTopics: Array.isArray(parsed.interviewTopics)
        ? parsed.interviewTopics.slice(0, 8)
        : [],
      basedOnPDF: true,
    };
  } catch (err: any) {
    console.error("[AIStudy] Key points parse error:", err.message);
    return FALLBACK_KEY_POINTS;
  }
}
