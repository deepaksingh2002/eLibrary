import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import axios from "axios";

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

export interface LangChainPdfResult {
  success: boolean;
  text: string;
  pages: number;
  error?: string;
}

export interface LangChainGenerateResult {
  success: boolean;
  text: string;
  error?: string;
}

function getModel(maxTokens?: number) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
    maxTokens,
  });
}

function parseJSON(text: string): any {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
}

async function downloadPDFToTempFile(
  pdfUrl: string,
  bookTitle: string,
): Promise<string | null> {
  const safeName = bookTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
  const tmpPath = path.join(os.tmpdir(), `elibrary_${Date.now()}_${safeName}.pdf`);

  try {
    console.log("[LangChain] Downloading PDF:", pdfUrl.slice(0, 60));

    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 80 * 1024 * 1024,
      headers: {
        "User-Agent": "eLibrary-Server/1.0",
      },
    });

    fs.writeFileSync(tmpPath, Buffer.from(response.data));
    console.log(
      "[LangChain] PDF saved to temp:",
      `${(response.data.byteLength / 1024 / 1024).toFixed(2)}MB`,
    );
    return tmpPath;
  } catch (err: any) {
    console.error("[LangChain] PDF download failed:", err?.message || err);
    return null;
  }
}

async function extractTextFromPDF(
  tmpPath: string,
): Promise<{ text: string; pages: number; success: boolean }> {
  try {
    const loader = new PDFLoader(tmpPath, {
      splitPages: false,
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      return { text: "", pages: 0, success: false };
    }

    const fullText = docs
      .map((doc) => doc.pageContent)
      .join("\n\n")
      .replace(/\n{4,}/g, "\n\n")
      .trim();

    const metadata = docs[0]?.metadata as any;
    const pages = metadata?.pdf?.totalPages || docs.length;
    const wordCount = fullText
      .split(/\s+/)
      .filter((word) => word.length > 2).length;

    console.log("[LangChain] Extracted:", wordCount, "words,", pages, "pages");

    if (wordCount < 50) {
      console.warn("[LangChain] Too few words - scanned PDF?");
      return { text: fullText, pages, success: false };
    }

    const capped =
      fullText.length > 60000
        ? `${fullText.slice(0, 60000)}\n\n[Content truncated]`
        : fullText;

    return { text: capped, pages, success: true };
  } catch (err: any) {
    console.error("[LangChain] PDFLoader failed:", err?.message || err);
    return { text: "", pages: 0, success: false };
  }
}

function cleanupTempFile(tmpPath: string): void {
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // ignore cleanup failures
  }
}

export async function loadBookPDF(
  pdfUrl: string,
  bookTitle: string,
  pdfBuffer?: Buffer,
): Promise<{
  text: string;
  pages: number;
  success: boolean;
  error?: string;
}> {
  let tmpPath: string | null = null;

  try {
    if (pdfBuffer && pdfBuffer.length > 0) {
      const safeName = bookTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
      tmpPath = path.join(os.tmpdir(), `elibrary_${Date.now()}_${safeName}.pdf`);
      fs.writeFileSync(tmpPath, pdfBuffer);
      console.log("[LangChain] Using provided buffer");
    } else {
      tmpPath = await downloadPDFToTempFile(pdfUrl, bookTitle);
    }

    if (!tmpPath) {
      return {
        text: "",
        pages: 0,
        success: false,
        error: "Could not download PDF. Check if the PDF URL is accessible.",
      };
    }

    const extracted = await extractTextFromPDF(tmpPath);

    if (!extracted.success || !extracted.text) {
      return {
        text: "",
        pages: extracted.pages,
        success: false,
        error:
          "PDF appears to be scanned or image-based. LangChain PDFLoader requires text-based PDFs.",
      };
    }

    return {
      text: extracted.text,
      pages: extracted.pages,
      success: true,
    };
  } finally {
    if (tmpPath) cleanupTempFile(tmpPath);
  }
}

async function generateJsonFromPdf(params: {
  pdfText: string;
  prompt: string;
  title: string;
  author?: string;
  genre?: string;
  count?: number;
  maxTokens: number;
}): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    const model = getModel(params.maxTokens);
    const parser = new StringOutputParser();

    const template = PromptTemplate.fromTemplate(`
You are an expert academic assistant.
Return ONLY valid JSON. No markdown, no commentary, no code fences.

Book: "{title}"
Author: {author}
Genre: {genre}

PDF Content:
---
{text}
---

Task:
{prompt}
`);

    const chain = RunnableSequence.from([template, model, parser]);

    const text = await chain.invoke({
      title: params.title,
      author: params.author || "Unknown",
      genre: params.genre || "Unknown",
      text: params.pdfText.slice(0, 50000),
      prompt: params.prompt,
    });

    return { success: true, text: String(text) };
  } catch (err: any) {
    return {
      success: false,
      text: "",
      error: err?.message || "LangChain generation failed",
    };
  }
}

export async function generateFromPdfWithLangChain(params: {
  pdfUrl: string;
  title: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<LangChainGenerateResult> {
  const extraction = await loadBookPDF(params.pdfUrl, params.title);

  if (!extraction.success || !extraction.text) {
    return {
      success: false,
      text: "",
      error: extraction.error || "Could not extract PDF text",
    };
  }

  return generateJsonFromPdf({
    pdfText: extraction.text,
    prompt: params.prompt,
    title: params.title,
    maxTokens: params.maxOutputTokens,
  });
}

export async function generateSummary(
  pdfText: string,
  bookTitle: string,
  author: string,
  genre: string,
): Promise<BookSummary> {
  const fallback: BookSummary = {
    overview: "Summary generation failed. Please try again.",
    keyThemes: ["Unavailable"],
    targetReader: "Unavailable",
    difficulty: "Intermediate",
    estimatedTime: "Unknown",
    basedOnPDF: false,
  };

  const result = await generateJsonFromPdf({
    pdfText,
    title: bookTitle,
    author,
    genre,
    maxTokens: 800,
    prompt: `Analyze this book content and return a JSON summary for students.

Return this exact JSON:
{
  "overview": "3-4 sentences about the book's actual content, main topics, and purpose. Reference specific topics from the PDF.",
  "keyThemes": ["theme from actual content", "theme 2", "theme 3", "theme 4", "theme 5"],
  "targetReader": "One sentence: who benefits most from this book",
  "difficulty": "Beginner or Intermediate or Advanced",
  "estimatedTime": "e.g. 6-8 hours"
}

Base your response ONLY on the PDF content provided above.
Do not use general knowledge about the book title.`,
  });

  if (!result.success || !result.text) {
    console.error("[LangChain] Summary failed:", result.error);
    return fallback;
  }

  try {
    const parsed = parseJSON(result.text);

    return {
      overview: parsed.overview || fallback.overview,
      keyThemes: Array.isArray(parsed.keyThemes)
        ? parsed.keyThemes.slice(0, 6)
        : fallback.keyThemes,
      targetReader: parsed.targetReader || fallback.targetReader,
      difficulty: ["Beginner", "Intermediate", "Advanced"].includes(
        parsed.difficulty,
      )
        ? parsed.difficulty
        : fallback.difficulty,
      estimatedTime: parsed.estimatedTime || fallback.estimatedTime,
      basedOnPDF: true,
    };
  } catch (err: any) {
    console.error("[LangChain] Summary parse error:", err?.message || err);
    return fallback;
  }
}

export async function generateMCQ(
  pdfText: string,
  bookTitle: string,
  count = 10,
): Promise<MCQQuestion[]> {
  const result = await generateJsonFromPdf({
    pdfText,
    title: bookTitle,
    maxTokens: 3000,
    prompt: `Read this PDF content and create exactly ${count} multiple choice questions.

Return this exact JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question about specific content from the PDF?",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct": "A",
      "explanation": "Why this is correct based on the PDF content",
      "topic": "Chapter or section this comes from"
    }
  ]
}

Requirements:
- 3 easy, 4 medium, 3 hard questions
- Every question must come from the PDF content above
- Wrong options must be plausible but clearly incorrect per the text
- Topics must reference actual sections from the PDF
- Explanations must cite specific content from the PDF
- Do not create generic questions not in this specific PDF`,
  });

  if (!result.success || !result.text) {
    console.error("[LangChain] MCQ failed:", result.error);
    return [];
  }

  try {
    const parsed = parseJSON(result.text);

    return (parsed.questions || [])
      .slice(0, count)
      .map((question: any, index: number) => ({
        id: index + 1,
        question: question.question || "",
        options: {
          A: question.options?.A || "",
          B: question.options?.B || "",
          C: question.options?.C || "",
          D: question.options?.D || "",
        },
        correct: ["A", "B", "C", "D"].includes(question.correct)
          ? question.correct
          : "A",
        explanation: question.explanation || "",
        topic: question.topic || "General",
      }))
      .filter((question: MCQQuestion) => question.question.length > 10);
  } catch (err: any) {
    console.error("[LangChain] MCQ parse error:", err?.message || err);
    return [];
  }
}

export async function generateKeyPoints(
  pdfText: string,
  bookTitle: string,
  author: string,
  genre: string,
): Promise<KeyPoints> {
  const fallback: KeyPoints = {
    chapters: [{ title: "Unavailable", points: ["Try again later"] }],
    glossary: [],
    takeaways: [],
    examTips: [],
    interviewTopics: [],
    basedOnPDF: false,
  };

  const result = await generateJsonFromPdf({
    pdfText,
    title: bookTitle,
    author,
    genre,
    maxTokens: 2500,
    prompt: `Read this PDF content carefully and extract the most important learning material.

Return this exact JSON:
{
  "chapters": [
    {
      "title": "Actual chapter name from the PDF",
      "points": [
        "Key fact or concept from this chapter",
        "Second important point",
        "Third key point"
      ]
    }
  ],
  "glossary": [
    {
      "term": "Technical term from the PDF",
      "definition": "Definition as used in this PDF"
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
    "Specific fact or formula from this PDF likely in exams",
    "Second exam-critical item from PDF",
    "Third exam topic",
    "Fourth exam topic",
    "Fifth exam topic"
  ],
  "interviewTopics": [
    "Technical concept from this PDF asked in interviews",
    "Second interview topic from this PDF",
    "Third interview concept",
    "Fourth interview topic",
    "Fifth interview topic"
  ]
}

Rules:
- 4-6 chapters matching actual PDF structure
- 8-12 glossary terms that appear in the PDF
- examTips must be specific memorizable facts from the PDF
- interviewTopics must be conceptual questions about actual content
- ALL content must come from the PDF only`,
  });

  if (!result.success || !result.text) {
    console.error("[LangChain] Key points failed:", result.error);
    return fallback;
  }

  try {
    const parsed = parseJSON(result.text);

    return {
      chapters: Array.isArray(parsed.chapters)
        ? parsed.chapters.slice(0, 8).map((chapter: any) => ({
            title: chapter.title || "Section",
            points: Array.isArray(chapter.points)
              ? chapter.points.slice(0, 5)
              : [],
          }))
        : fallback.chapters,
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary
            .slice(0, 15)
            .map((entry: any) => ({
              term: entry.term || "",
              definition: entry.definition || "",
            }))
            .filter((entry: { term: string; definition: string }) =>
              Boolean(entry.term && entry.definition),
            )
        : [],
      takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.slice(0, 6) : [],
      examTips: Array.isArray(parsed.examTips) ? parsed.examTips.slice(0, 8) : [],
      interviewTopics: Array.isArray(parsed.interviewTopics)
        ? parsed.interviewTopics.slice(0, 8)
        : [],
      basedOnPDF: true,
    };
  } catch (err: any) {
    console.error("[LangChain] Key points parse error:", err?.message || err);
    return fallback;
  }
}
