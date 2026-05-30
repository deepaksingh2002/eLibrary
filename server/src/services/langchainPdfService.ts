import crypto from "crypto";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import axios from "axios";
import { processBookPdf } from "./pdfPipelineService";
import { generateProductionMCQs } from "../mcq/mcqPipeline";

export interface BookSummary {
  overview: string;
  keyThemes: string[];
  targetReader: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  basedOnPDF: boolean;
}

export interface ChapterRange {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
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

function getModel(maxTokens?: number, temperature?: number) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: typeof temperature === "number" ? temperature : 0.2,
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: maxTokens,
  } as any);
}

function parseJSON(text: string): any {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanupExtractedPdfText(text: string): string {
  return text
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\bpage\s*\d+\b/gi, " ")
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function shortenText(text: string, maxLength = 140): string {
  const normalized = normalizeWhitespace(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function compactMCQText(text: string, maxLength = 90): string {
  const normalized = normalizeWhitespace(text)
    .replace(/^(?:according to the passage|in the passage|this chapter|the chapter|the text|the book)[\s,:;-]*/i, "")
    .replace(/^(?:the passage|the chapter|the text|the book)[\s,:;-]*/i, "")
    .replace(/[.?!:;]+$/g, "");

  return shortenText(normalized, maxLength).replace(/[.?!:;]+$/g, "");
}

const TOPIC_PREFIX_PATTERNS = [
  /^(?:in this book|this book|in this chapter|this chapter|chapter\s+\d+|chapter\s+[ivxlcdm]+|note|note that|you may not remember|when i talk about|i'll talk about|i will talk about|as a reminder|keep in mind)\b[\s,:;\-]*/i,
]

const TOPIC_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "their",
  "there",
  "about",
  "which",
  "when",
  "where",
  "what",
  "were",
  "will",
  "would",
  "shall",
  "should",
  "could",
  "can",
  "have",
  "has",
  "had",
  "been",
  "are",
  "was",
  "its",
  "than",
  "then",
  "also",
  "over",
  "under",
  "more",
  "most",
  "such",
  "each",
  "some",
  "many",
  "much",
  "your",
  "our",
  "they",
  "them",
  "his",
  "her",
  "him",
  "she",
  "himself",
  "herself",
  "itself",
  "because",
  "through",
  "between",
  "within",
  "without",
  "during",
  "while",
  "these",
  "those",
  "chapter",
  "section",
  "pdf",
  "book",
])

function buildTopicFromSentence(sentence: string, fallbackTopic: string): string {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "their",
    "there",
    "about",
    "which",
    "when",
    "where",
    "what",
    "were",
    "will",
    "would",
    "shall",
    "should",
    "could",
    "can",
    "have",
    "has",
    "had",
    "been",
    "are",
    "was",
    "its",
    "than",
    "then",
    "also",
    "over",
    "under",
    "more",
    "most",
    "such",
    "each",
    "some",
    "many",
    "much",
    "your",
    "our",
    "they",
    "them",
    "his",
    "her",
    "him",
    "she",
    "himself",
    "herself",
    "itself",
    "because",
    "through",
    "between",
    "within",
    "without",
    "during",
    "while",
    "these",
    "those",
    "chapter",
    "section",
    "pdf",
    "book",
  ])

  const words = normalizeWhitespace(sentence)
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()))

  if (words.length === 0) {
    return fallbackTopic
  }

  return words.slice(0, 4).join(" ")
}

function extractFallbackFacts(pdfText: string, bookTitle: string): Array<{ topic: string; fact: string }> {
  const blocks = pdfText
    .split(/\n{2,}/)
    .map((block) => normalizeWhitespace(block))
    .filter((block) => block.length > 0)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/g))
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 60 && sentence.length <= 220)
    .filter((sentence) => /[a-zA-Z]/.test(sentence))

  const uniqueFacts = new Map<string, { topic: string; fact: string }>()

  for (const sentence of blocks) {
    const fact = shortenText(sentence, 150)
    if (uniqueFacts.has(fact)) {
      continue
    }

    uniqueFacts.set(fact, {
      topic: buildTopicFromSentence(sentence, bookTitle || "the PDF"),
      fact,
    })
  }

  return Array.from(uniqueFacts.values())
}

function deterministicIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0
  }

  const digest = crypto.createHash("sha1").update(seed).digest()
  return digest.readUInt32BE(0) % length
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = deterministicIndex(`${seed}:${index}`, index + 1)
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  return result
}

function normalizeQuestionKey(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function dedupeMCQQuestions(questions: MCQQuestion[]): MCQQuestion[] {
  const seen = new Set<string>()
  const deduped: MCQQuestion[] = []

  for (const question of questions) {
    const key = normalizeQuestionKey(question.question)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(question)
  }

  return deduped
}

function buildFallbackMCQQuestions(
  pdfText: string,
  bookTitle: string,
  count: number,
  chapterFocus?: string,
): MCQQuestion[] {
  console.warn(
    "[LangChain] Generating fallback MCQs from PDF text (low quality, deterministic).",
  )

  const facts = extractFallbackFacts(pdfText, bookTitle)
  if (facts.length < 3) return []

  const items: MCQQuestion[] = []
  const usedCorrect = new Set<string>()
  const usedQuestions = new Set<string>()
  const seedOrder = shuffleWithSeed(Array.from(Array(facts.length).keys()), `${bookTitle || "fallback"}:facts`)
  const questionTemplates = [
    (topic: string) => `What is the key idea about ${topic}?`,
    (topic: string) => `Why does the passage mention ${topic}?`,
    (topic: string) => `What does the passage say about ${topic}?`,
    (topic: string) => `What is true about ${topic}?`,
    (topic: string) => `How does ${topic} work in the passage?`,
    (topic: string) => `What result does the passage connect to ${topic}?`,
  ]

  for (let i = 0; i < Math.min(count, facts.length); i += 1) {
    const fact = facts[seedOrder[i % seedOrder.length]]
    const correctFull = compactMCQText(fact.fact, 110)
    const correctKey = normalizeQuestionKey(correctFull)
    if (!correctFull || usedCorrect.has(correctKey)) continue
    usedCorrect.add(correctKey)

    const question = questionTemplates[i % questionTemplates.length](chapterFocus || fact.topic || "the passage")
    const questionKey = normalizeQuestionKey(question)
    if (usedQuestions.has(questionKey)) continue
    usedQuestions.add(questionKey)

    const distractors = facts
      .filter((candidate) => normalizeQuestionKey(candidate.fact) !== correctKey)
      .map((candidate) => compactMCQText(candidate.fact, 90))
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .slice(0, 3)

    while (distractors.length < 3) {
      distractors.push(
        chapterFocus
          ? compactMCQText(`A different detail from ${chapterFocus}`, 90)
          : compactMCQText(`A different detail from the passage`, 90),
      )
    }

    const options = shuffleWithSeed([correctFull, ...distractors].slice(0, 4), `${bookTitle || "fallback"}:${question}:${i}`)
    const correctIndex = options.findIndex((option) => normalizeQuestionKey(option) === correctKey)
    const correctLetter = (['A', 'B', 'C', 'D'][correctIndex >= 0 ? correctIndex : 0] as unknown) as
      | 'A'
      | 'B'
      | 'C'
      | 'D'

    items.push({
      id: items.length + 1,
      question,
      options: {
        A: options[0] || "",
        B: options[1] || "",
        C: options[2] || "",
        D: options[3] || "",
      },
      correct: correctLetter,
      explanation: correctFull,
      topic: fact.topic || chapterFocus || "Fallback",
    })
  }

  return dedupeMCQQuestions(items)
}

function buildFallbackSummary(
  pdfText: string,
  bookTitle: string,
  author: string,
  genre: string,
): BookSummary {
  const sentences = pdfText
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 40)

  const overviewSentences = sentences.slice(0, 3).map((sentence) => shortenText(sentence, 160))
  const themeSeeds = extractFallbackFacts(pdfText, bookTitle)
    .map((fact) => fact.topic)
    .filter((topic, index, topics) => topics.indexOf(topic) === index)
    .slice(0, 5)

  return {
    overview: overviewSentences.length > 0
      ? `${overviewSentences.join(" ")} This fallback summary was built directly from the PDF text for ${bookTitle}.`
      : `This fallback summary was built directly from the PDF text for ${bookTitle}.`,
    keyThemes: themeSeeds.length > 0 ? themeSeeds : [bookTitle || "PDF content", genre || "General topics"],
    targetReader: author
      ? `Readers interested in ${genre || "this subject"} and the work associated with ${author}.`
      : `Readers interested in ${genre || "this subject"}.`,
    difficulty: sentences.length > 20 ? "Advanced" : sentences.length > 10 ? "Intermediate" : "Beginner",
    estimatedTime: sentences.length > 20 ? "6-8 hours" : sentences.length > 10 ? "3-5 hours" : "1-2 hours",
    basedOnPDF: true,
  }
}

function buildFallbackKeyPoints(pdfText: string, bookTitle: string, author: string, genre: string): KeyPoints {
  const facts = extractFallbackFacts(pdfText, bookTitle).slice(0, 8)
  const chapterGroups = facts.slice(0, 3).map((fact, index) => ({
    title: fact.topic || `Section ${index + 1}`,
    points: [fact.fact],
  }))

  const glossary = facts.slice(0, 5).map((fact) => {
    const term = fact.topic.split(" ").slice(0, 3).join(" ")
    return {
      term: term || fact.topic,
      definition: fact.fact,
    }
  })

  const takeaways = facts.slice(0, 5).map((fact) => fact.fact)

  return {
    chapters: chapterGroups.length > 0
      ? chapterGroups
      : [{ title: bookTitle || "PDF content", points: ["No structured chapter text could be extracted."] }],
    glossary: glossary.length > 0 ? glossary : [],
    takeaways: takeaways.length > 0 ? takeaways : [`Review the PDF content for ${bookTitle}.`],
    examTips: [
      `Focus on the recurring ideas in ${genre || "the book"}.`,
      author ? `Connect examples back to ${author}'s discussion in the PDF.` : "Connect key statements back to the PDF text.",
    ],
    interviewTopics: [
      `Core ideas from ${bookTitle}`,
      genre ? `Questions about ${genre}` : "Questions about the PDF's main subject",
    ],
    basedOnPDF: true,
  }
}

function buildChapterStudyGuide(chapterText: string, chapterLabel: string, maxItems = 8): string {
  const facts = extractFallbackFacts(chapterText, chapterLabel)
    .slice(0, maxItems)
    .map((fact, index) => `${index + 1}. ${fact.topic}: ${fact.fact}`)

  if (facts.length > 0) {
    return facts.join("\n")
  }

  const sentences = chapterText
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 50)
    .slice(0, maxItems)
    .map((sentence, index) => `${index + 1}. ${shortenText(sentence, 180)}`)

  return sentences.join("\n")
}

function sanitizeMCQContext(pdfText: string): string {
  const bannedPatterns = [
    /\bMEAP\b/i,
    /\bManning\b/i,
    /\bcopyright\b/i,
    /\bISBN\b/i,
    /^\s*chapter\s+\d+\s*[:\-]?\s*$/i,
    /^\s*section\s+\d+\s*[:\-]?\s*$/i,
    /^\s*page\s+\d+\s*$/i,
    /publisher\s+notes?/i,
    /table of contents/i,
    /https?:\/\//i,
  ]

  return pdfText
    .split(/\n{2,}/g)
    .map((block) => normalizeWhitespace(block))
    .filter((block) => block.length > 0)
    .filter((block) => !bannedPatterns.some((pattern) => pattern.test(block)))
    .join("\n\n")
}

function hasUsableMCQContext(pdfText: string): boolean {
  const normalized = normalizeWhitespace(pdfText);
  if (normalized.length < 240) {
    return false;
  }

  return !/\b(MEAP|Manning|copyright|ISBN|publisher notes?)\b/i.test(normalized);
}

function isGenericMCQQuestion(question: string, explanation: string): boolean {
  const text = `${question} ${explanation}`.toLowerCase();

  return [
    "which statement about",
    "what does the passage indicate",
    "according to the passage",
    "which of the following best summarizes",
    "why is",
    "what outcome or idea does the passage connect",
    "supported by the passage",
    "selected chapter",
    "understand most clearly",
    "supported by the pdf",
    "supported by the passage",
    "professor testing",
    "chapter on ",
    "source text",
    "pdf content",
  ].some((phrase) => text.includes(phrase));
}

function isRetryableGenerationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  return (
    lowered.includes("429") ||
    lowered.includes("quota") ||
    lowered.includes("rate limit") ||
    lowered.includes("too many requests")
  );
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
    const cleanedText = cleanupExtractedPdfText(fullText);

    const metadata = docs[0]?.metadata as any;
    const pages = metadata?.pdf?.totalPages || docs.length;
    const wordCount = cleanedText
      .split(/\s+/)
      .filter((word) => word.length > 2).length;

    console.log("[LangChain] Extracted:", wordCount, "words,", pages, "pages");

    if (wordCount < 50) {
      console.warn("[LangChain] Too few words - scanned PDF?");
      return { text: fullText, pages, success: false };
    }

    const capped =
      cleanedText.length > 60000
        ? `${cleanedText.slice(0, 60000)}\n\n[Content truncated]`
        : cleanedText;

    return { text: capped, pages, success: true };
  } catch (err: any) {
    console.error("[LangChain] PDFLoader failed:", err?.message || err);
    return { text: "", pages: 0, success: false };
  }
}

async function extractPagesFromPDF(
  tmpPath: string,
): Promise<{ pages: Array<{ pageNumber: number; text: string }>; totalPages: number; success: boolean }> {
  try {
    const loader = new PDFLoader(tmpPath, {
      splitPages: true,
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      return { pages: [], totalPages: 0, success: false };
    }

    const pages = docs
      .map((doc, index) => {
        const metadata = doc.metadata as any;
        const pageNumber = metadata?.loc?.pageNumber || metadata?.pageNumber || metadata?.page || index + 1;

        return {
          pageNumber: Number.isFinite(Number(pageNumber)) ? Number(pageNumber) : index + 1,
          text: cleanupExtractedPdfText(doc.pageContent.replace(/\n{4,}/g, "\n\n").trim()),
        };
      })
      .filter((page) => page.text.length > 0);

    const metadata = docs[0]?.metadata as any;
    const totalPages = metadata?.pdf?.totalPages || pages.length;

    return {
      pages,
      totalPages,
      success: pages.length > 0,
    };
  } catch (err: any) {
    console.error("[LangChain] PDFLoader split-pages failed:", err?.message || err);
    return { pages: [], totalPages: 0, success: false };
  }
}

function cleanupTempFile(tmpPath: string): void {
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // ignore cleanup failures
  }
}

async function loadBookPdfWithExtractor<T>(
  pdfUrl: string,
  bookTitle: string,
  pdfBuffer: Buffer | undefined,
  extractor: (tmpPath: string) => Promise<T>,
): Promise<T | null> {
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
      return null;
    }

    return await extractor(tmpPath);
  } finally {
    if (tmpPath) cleanupTempFile(tmpPath);
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
  chapters?: Array<{ chapter: string; startPage: number; endPage: number }>;
  usedOcr?: boolean;
  error?: string;
}> {
  const extracted = await processBookPdf(pdfUrl, bookTitle);

  if (!extracted.success || !extracted.text) {
    return {
      text: "",
      pages: 0,
      success: false,
      chapters: [],
      usedOcr: extracted.usedOcr,
      error: extracted.error || "Could not read PDF text",
    };
  }

  return {
    text: extracted.text,
    pages: extracted.totalPages,
    success: true,
    chapters: extracted.chapters,
    usedOcr: extracted.usedOcr,
  };
}

export async function loadBookPDFPages(
  pdfUrl: string,
  bookTitle: string,
  pdfBuffer?: Buffer,
): Promise<{
  pages: Array<{ pageNumber: number; text: string }>;
  totalPages: number;
  success: boolean;
  chapters?: Array<{ chapter: string; startPage: number; endPage: number }>;
  usedOcr?: boolean;
  error?: string;
}> {
  const extracted = await processBookPdf(pdfUrl, bookTitle);

  if (!extracted.success || extracted.pages.length === 0) {
    return {
      pages: [],
      totalPages: 0,
      success: false,
      chapters: [],
      usedOcr: extracted.usedOcr,
      error: extracted.error || "Could not read PDF pages",
    };
  }

  return {
    pages: extracted.pages.map((page) => ({
      pageNumber: page.pageNumber,
      text: page.text,
    })),
    totalPages: extracted.totalPages,
    success: true,
    chapters: extracted.chapters,
    usedOcr: extracted.usedOcr,
  };
}

function normalizeTocTitle(title: string): string {
  return title
    .replace(/^(chapter|chap\.?|section|part)\s+([0-9ivxlcdm]+[\s.:\-]*)?/i, "")
    .replace(/^\d+[\s.:\-]*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.·•\-–—]+$/g, "")
    .trim();
}

function romanToInt(roman: string): number {
  if (!roman) return 0;
  const s = roman.trim().toUpperCase();
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    const c = s[i];
    const val = map[c] || 0;
    if (val < prev) {
      total -= val;
    } else {
      total += val;
    }
    prev = val;
  }
  return total;
}

function parseTocLine(line: string): { title: string; startPage: number } | null {
  const normalized = normalizeWhitespace(line).replace(/^[•·\-–—]+\s*/, "");
  if (!normalized || normalized.length < 6 || !/[A-Za-z]/.test(normalized)) {
    return null;
  }

  // Accept Arabic numerals or Roman numerals at line end
  const pageMatch = normalized.match(/(\d{1,4}|[ivxlcdmIVXLCDM]+)\s*$/);
  if (!pageMatch) {
    return null;
  }

  let startPage = 0;
  const rawPage = pageMatch[1];
  if (/^\d+$/.test(rawPage)) {
    startPage = Number(rawPage);
  } else {
    // roman numeral -> convert to arabic
    const rv = romanToInt(rawPage);
    if (rv > 0) startPage = rv;
  }

  if (!Number.isFinite(startPage) || startPage < 1) {
    return null;
  }

  const rawTitle = normalized.slice(0, pageMatch.index).replace(/\.{2,}\s*$/, "").trim();
  const title = normalizeTocTitle(rawTitle);

  if (!title || title.length < 3) {
    return null;
  }

  if (/^(contents|table of contents|index|preface|acknowledg(e)?ments|foreword|introduction)$/i.test(title)) {
    return null;
  }

  return {
    title,
    startPage,
  };
}

export function extractChapterIndexFromPages(
  pages: Array<{ pageNumber: number; text: string }>,
  totalPages: number,
): ChapterRange[] {
  const tocCandidates: Array<{ title: string; startPage: number }> = [];

  // Find the page where the main content starts (prefer 'Introduction' or 'Chapter 1')
  const introPatterns = [/\bintroduction\b/i, /^\s*chapter\s*1\b/i, /^\s*1[\.\)]\s+/i];
  let startIndex = 0;
  for (let i = 0; i < Math.min(pages.length, 20); i += 1) {
    const p = pages[i];
    if (!p || !p.text) continue;
    const lines = p.text.split(/\n+/).map((l) => normalizeWhitespace(l)).filter(Boolean);
    if (lines.some((l) => introPatterns.some((pat) => pat.test(l)))) {
      startIndex = i; // start scanning from this page
      break;
    }
  }

  const scanPages = pages.slice(startIndex, Math.min(pages.length, startIndex + 10));

  // Try to locate an explicit TOC/header (handles variants like "Table of Contents", "Contents", "Brief Contents", etc.)
  const headerPatterns = [
    /^\s*table of contents\s*$/i,
    /^\s*contents\s*$/i,
    /^\s*brief contents\s*$/i,
    /^\s*brief table of contents\s*$/i,
    /^\s*index\s*$/i,
    /^\s*chapters\s*$/i,
  ];

  let foundHeader = false;
  const candidateLines: Array<{ line: string; pageNumber: number }> = [];

  for (const page of scanPages) {
    const lines = page.text
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line.length > 0);

    if (!foundHeader) {
      for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        if (headerPatterns.some((pat) => pat.test(l))) {
          foundHeader = true;
          // collect remainder of this page starting after the header
          for (let j = i + 1; j < lines.length; j += 1) {
            candidateLines.push({ line: lines[j], pageNumber: page.pageNumber });
          }
          break;
        }
      }
      if (foundHeader) {
        // also continue by collecting following pages' lines
        continue;
      }
    }

    if (foundHeader) {
      for (const l of lines) {
        candidateLines.push({ line: l, pageNumber: page.pageNumber });
      }
    } else {
      // no explicit header found yet — fall back to scanning all short-range pages for TOC-like lines
      for (const l of lines) {
        const parsed = parseTocLine(l);
        if (parsed) {
          tocCandidates.push(parsed);
        }
      }
    }

    // Also try to detect in-content chapter headings starting from the introduction page
    const chapterHeadingPatterns = [
        /^\s*chapter\s+\d+\b/i,
        /^\s*chapter\s+[ivxlcdm]+\b/i,
        /^\s*\d+\s*[\.\)]\s+[A-Za-z].{2,100}$/i,
        /^\s*[IVXLCDM]+\s*[\.\)]\s+[A-Za-z].{2,100}$/i,
        /^\s*chapter\s+\w+\b/i,
        /^(chapter)\s*[:\-]\s*\w+/i,
        /^(part)\s+\w+/i,
        /^\s*[A-Za-z\s]{3,100}\s+[\.]{2,}\s+\d{1,4}$/i,
    ];

    for (const l of lines) {
      if (chapterHeadingPatterns.some((pat) => pat.test(l))) {
        const title = normalizeTocTitle(l);
        if (title && title.length > 0) {
          tocCandidates.push({ title, startPage: page.pageNumber });
        }
        break; // assume heading appears once per page
      }
    }
  }

  // If we found a header and collected candidate lines, parse them for TOC entries
  if (foundHeader && candidateLines.length > 0) {
    for (const entry of candidateLines) {
      const parsed = parseTocLine(entry.line);
      if (parsed) {
        // prefer page number from parsed value
        tocCandidates.push(parsed);
      }
    }
  }

  const deduped = Array.from(
    new Map(
      tocCandidates
        .sort((left, right) => left.startPage - right.startPage)
        .map((entry) => [`${entry.startPage}:${entry.title.toLowerCase()}`, entry]),
    ).values(),
  );

  if (deduped.length < 2) {
    return [];
  }

  return deduped.map((entry, index) => ({
    number: index + 1,
    title: entry.title,
    startPage: entry.startPage,
    endPage: Math.max(
      entry.startPage,
      (deduped[index + 1]?.startPage || (totalPages > 0 ? totalPages + 1 : entry.startPage + 1)) - 1,
    ),
  }));
}

export async function extractChapterIndexFromPagesAsync(
  pages: Array<{ pageNumber: number; text: string }>,
  totalPages: number,
  title?: string,
): Promise<ChapterRange[]> {
  // First try quick heuristic
  const heuristic = extractChapterIndexFromPages(pages, totalPages);
  if (heuristic && heuristic.length > 1) {
    return heuristic;
  }

  // Fallback to LangChain-based TOC extraction using the first few pages as context
  // Prefer snippet starting from Introduction/Chapter 1 to avoid front-matter
  const introPatterns = [/\bintroduction\b/i, /^\s*chapter\s*1\b/i, /^\s*1[\.\)]\s+/i];
  let startIndex = 0;
  for (let i = 0; i < Math.min(pages.length, 20); i += 1) {
    const p = pages[i];
    if (!p || !p.text) continue;
    const lines = p.text.split(/\n+/).map((l) => normalizeWhitespace(l)).filter(Boolean);
    if (lines.some((l) => introPatterns.some((pat) => pat.test(l)))) {
      startIndex = i;
      break;
    }
  }

  const snippet = pages
    .slice(startIndex, Math.min(pages.length, startIndex + 8))
    .map((p) => p.text)
    .join("\n\n")
    .slice(0, 45000);

  try {
    const result = await generateJsonFromPdf({
      pdfText: snippet,
      title: title || "",
      author: "",
      genre: "",
      maxTokens: 800,
      prompt: `Find any table of contents or index-like section in the PDF content provided. Return ONLY valid JSON with the following shape:
{
  "chapters": [
    { "number": 1, "title": "Chapter title text", "startPage": 12 }
  ]
}

Rules:
- Base entries only on text provided above. If page numbers are not present, try to estimate start pages relative to the provided page snippet (use 1-based page numbers). If you cannot determine pages, omit the entry.
- Return at most 40 entries.
- Do not include preface/acknowledgements as chapter entries.`,
    });

    if (!result.success || !result.text) {
      return heuristic;
    }

    try {
      const parsed = parseJSON(result.text);
      if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
        return heuristic;
      }

      const chapters: ChapterRange[] = parsed.chapters
        .map((c: any, idx: number) => ({
          number: Number.isFinite(Number(c.number)) ? Number(c.number) : idx + 1,
          title: (c.title || `Chapter ${idx + 1}`) as string,
          startPage: Number.isFinite(Number(c.startPage)) ? Number(c.startPage) : 1,
        }))
        .sort((a: ChapterRange, b: ChapterRange) => a.startPage - b.startPage)
        .map((entry: ChapterRange, i: number, arr: ChapterRange[]) => ({
          ...entry,
          // end page is next start -1 or totalPages
          endPage: Math.max(
            entry.startPage,
            (arr[i + 1]?.startPage || (totalPages > 0 ? totalPages + 1 : entry.startPage + 1)) - 1,
          ),
        }));

      if (chapters.length > 0) return chapters;
    } catch (err) {
      // fall through to return heuristic
      console.error("[LangChain] TOC parse error:", (err as any)?.message || err);
    }
  } catch (err: any) {
    console.error("[LangChain] TOC extraction failed:", err?.message || err);
  }

  return heuristic;
}

export function resolveChapterRange(
  chapters: ChapterRange[],
  selection?: string,
): ChapterRange | null {
  if (!selection || chapters.length === 0) {
    return null;
  }

  const numericSelection = Number.parseInt(selection, 10);
  if (Number.isFinite(numericSelection)) {
    const byNumber = chapters.find((chapter) => chapter.number === numericSelection);
    if (byNumber) {
      return byNumber;
    }
  }

  const normalizedSelection = normalizeWhitespace(selection).toLowerCase();
  return (
    chapters.find((chapter) => {
      const normalizedTitle = normalizeWhitespace(chapter.title).toLowerCase();
      return normalizedTitle === normalizedSelection || normalizedTitle.includes(normalizedSelection) || normalizedSelection.includes(normalizedTitle);
    }) || null
  );
}

export function slicePagesForChapter(
  pages: Array<{ pageNumber: number; text: string }>,
  range: ChapterRange,
): string {
  return pages
    .filter((page) => page.pageNumber >= range.startPage && page.pageNumber <= range.endPage)
    .map((page) => page.text)
    .filter((text) => text.length > 0)
    .join("\n\n");
}

async function generateJsonFromPdf(params: {
  pdfText: string;
  prompt: string;
  title: string;
  author?: string;
  genre?: string;
  count?: number;
  maxTokens: number;
  temperature?: number;
}): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    const model = getModel(params.maxTokens, params.temperature);
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
  const fallback = buildFallbackSummary(pdfText, bookTitle, author, genre);

  const result = await generateJsonFromPdf({
    pdfText,
    title: bookTitle,
    author,
    genre,
    maxTokens: 800,
    temperature: 0.1,
    prompt: `Analyze this book content and return a JSON summary tailored for students and busy readers.

Return this exact JSON:
{
  "overview": "3-4 sentences about the book's actual content, main topics, and purpose. Reference specific topics from the PDF.",
  "keyThemes": ["theme from actual content", "theme 2", "theme 3", "theme 4", "theme 5"],
  "targetReader": "2-3 short persuasive sentences that explain why a reader should pick up this book: emphasize concrete benefits, actionable outcomes, and who will benefit most (e.g., students, practitioners, managers). Use an engaging, reader-attracting tone—avoid generic phrasing.",
  "difficulty": "Beginner or Intermediate or Advanced",
  "estimatedTime": "e.g. 6-8 hours"
}

Guidelines:
- Base your response ONLY on the PDF content provided above. Do not invent outside facts.
- For "targetReader", write a persuasive author-style pitch (2-4 short sentences) written in the voice of the book's author or a passionate advocate. Address the reader directly, emphasize concrete benefits and actionable outcomes, and give a compelling reason to pick up the book now. Use vivid, engaging language tied to the PDF content; avoid vague or generic phrasing.
- Use specific language tied to the PDF content; avoid vague summaries.
`,
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
   chapterFocus?: string,
): Promise<{ questions: MCQQuestion[]; fallbackUsed: boolean }> {
  const chapterLabel = chapterFocus
    ? /^chapter\b/i.test(chapterFocus.trim())
      ? chapterFocus.trim()
      : `Chapter ${chapterFocus.trim()}`
    : "Chapter 1"

  // New MCQ generation: temperature=0, strict grounding, chunk-based + verification
  if (!process.env.GEMINI_API_KEY) {
    console.error("[MCQ] GEMINI_API_KEY not set");
    return { questions: [], fallbackUsed: false };
  }

  if (!pdfText || pdfText.trim().length < 200) {
    console.error("[MCQ] Insufficient PDF text for MCQ generation");
    return { questions: [], fallbackUsed: false };
  }

  const model = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: 3000,
  } as any);

  const CHUNK_SIZE = 3000;
  const chunks = splitTextIntoChunks(pdfText, CHUNK_SIZE);
  const questionsPerChunk = Math.ceil(count / Math.min(chunks.length, 5));
  const chunksToUse = chunks.slice(0, Math.ceil(count / questionsPerChunk));

  console.log("[MCQ] Generating", count, "questions from", chunksToUse.length, "chunks");

  const allQuestions: MCQQuestion[] = [];
  let quotaBlocked = false;

  for (let i = 0; i < chunksToUse.length; i++) {
    const chunk = chunksToUse[i];
    const needed = Math.min(questionsPerChunk, count - allQuestions.length);
    if (needed <= 0) break;

    console.log(`[MCQ] Processing chunk ${i + 1}/${chunksToUse.length}, generating ${needed} questions`);

    const parser = new StringOutputParser();
    const prompt = PromptTemplate.fromTemplate(`
  You are a strict academic quiz generator.
  Your ONLY job is to create concise, book-specific quiz questions from the provided text.

CRITICAL RULES — FOLLOW EXACTLY:
1. ONLY create questions about content in the TEXT BELOW
2. If a question cannot be answered from the text, SKIP IT
3. NEVER use general knowledge, Wikipedia, or training data
4. Every correct answer MUST appear in or be directly
   inferable from the TEXT BELOW
5. Copy key phrases from the text into explanations
   to prove the answer is grounded
  6. Write short, direct question stems. Prefer "What is...", "Why does...", "How does...", or "What happens when..."
  7. Avoid generic stems like "Which statement about...", "According to the passage...", or "What does the passage indicate..."
  8. Keep answer choices short, concrete, and clearly different from each other

Book: "{title}"
Chunk {chunkNum} of {totalChunks}

TEXT TO USE (and ONLY this text):
===START===
{text}
===END===

Generate exactly {needed} multiple choice questions
from the TEXT ABOVE ONLY.

Style target:
- Make the question feel like a good textbook quiz item.
- Keep it specific to the chapter content.
- Do not repeat the chapter title in the question unless it is necessary.
- Do not write long passage-based stems when a direct question is possible.

Good examples:
- What is the key requirement for binary search to work correctly?
- You have a sorted list of 100 items. In the worst case, how many steps does binary search take?
- What does binary search do to the search space after each comparison?

Avoid these patterns:
- Which statement about Chapter 1 is supported by the passage?
- What does the passage indicate about Chapter 1?
- According to the passage, which detail is accurate?

Return ONLY this JSON (no markdown, no extra text):
{{
  "questions": [
    {{
      "question": "Question about specific content in the text above?",
      "options": {{
        "A": "Option from the text",
        "B": "Plausible wrong option",
        "C": "Plausible wrong option",
        "D": "Plausible wrong option"
      }},
      "correct": "A",
      "explanation": "Quote the relevant part: \"[exact phrase from text]\" — this shows the correct answer",
      "topic": "Section or concept this question covers",
      "source_quote": "Copy the exact sentence from the text that proves this answer"
    }}
  ]
}}

If you cannot find {needed} questions from this text,
return fewer questions rather than making up questions.
QUALITY OVER QUANTITY.
`
    );

    try {
      const chain = RunnableSequence.from([prompt, model, parser]);
      const result: any = await chain.invoke({
        title: bookTitle,
        text: chunk,
        needed: needed.toString(),
        chunkNum: (i + 1).toString(),
        totalChunks: chunksToUse.length.toString(),
      });

      const parsed = parseJSON(String(result));
      const questions = parsed.questions || [];

      const verified = verifyMCQAnswers(questions, chunk);
      allQuestions.push(...verified);

      console.log(`[MCQ] Chunk ${i + 1}: ${questions.length} generated, ${verified.length} verified`);
    } catch (err: any) {
      console.error(`[MCQ] Chunk ${i + 1} failed:`, err?.message || err);

      const errorText = String(err?.message || err || "").toLowerCase();
      if (
        errorText.includes("429") ||
        errorText.includes("too many requests") ||
        errorText.includes("quota exceeded") ||
        errorText.includes("rate limit")
      ) {
        quotaBlocked = true;
        console.warn("[MCQ] Gemini quota/rate-limit hit; stopping remaining chunk calls.");
        break;
      }
    }

    if (i < chunksToUse.length - 1) await new Promise((r) => setTimeout(r, 300));
  }

  const uniqueQuestions = dedupeMCQQuestions(allQuestions)

  if (uniqueQuestions.length === 0) {
    console.warn("[MCQ] No verified questions generated");
    const fallbackQuestions = buildFallbackMCQQuestions(pdfText, bookTitle, count, chapterLabel);
    if (fallbackQuestions.length > 0) {
      if (quotaBlocked) {
        console.warn("[MCQ] Returning fallback MCQs due to Gemini quota/rate-limit.");
      }
      return { questions: fallbackQuestions, fallbackUsed: true };
    }
    return { questions: [], fallbackUsed: false };
  }

  return {
    questions: uniqueQuestions.slice(0, count).map((q, i) => ({ ...q, id: i + 1 })),
    fallbackUsed: false,
  }
}

// Split text into overlapping chunks
function splitTextIntoChunks(text: string, chunkSize: number, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const paraEnd = text.lastIndexOf("\n\n", end);
      if (paraEnd > start + chunkSize * 0.6) {
        end = paraEnd;
      } else {
        const sentEnd = text.lastIndexOf('. ', end);
        if (sentEnd > start + chunkSize * 0.5) end = sentEnd + 1;
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 200) chunks.push(chunk);
    start = end - overlap;
    if (start <= 0) start = end;
  }
  return chunks;
}

function verifyMCQAnswers(questions: any[], sourceText: string): MCQQuestion[] {
  const verified: MCQQuestion[] = [];
  const lowerSource = sourceText.toLowerCase();

  for (const q of questions) {
    if (!q.question || q.question.length < 15) continue;
    if (!q.options?.A || !q.options?.B) continue;
    if (!["A", "B", "C", "D"].includes(q.correct)) continue;
    if (!q.explanation || q.explanation.length < 20) continue;

    const opts = [q.options.A, q.options.B, q.options.C, q.options.D];
    const unique = new Set(opts.map((o: string) => o?.toLowerCase().trim()));
    if (unique.size < 3) continue;

    const genericPhrases = [
      "what is the main topic",
      "what is the purpose of this book",
      "who is the author",
      "what does the book discuss",
      "which of the following is true about",
    ];
    const lowerQ = q.question.toLowerCase();
    if (genericPhrases.some((p) => lowerQ.includes(p))) continue;

    const questionWords = q.question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 4);

    const foundInSource = questionWords.filter((w: string) => lowerSource.includes(w)).length;
    const groundingRatio = foundInSource / Math.max(questionWords.length, 1);
    if (groundingRatio < 0.3) {
      console.log("[MCQ] Rejected (not grounded):", q.question.slice(0, 60));
      continue;
    }

    if (isGenericMCQQuestion(q.question, q.explanation)) {
      console.log("[MCQ] Rejected (generic stem):", q.question.slice(0, 60));
      continue;
    }

    const cleanQuestion: MCQQuestion = {
      id: 0,
      question: q.question.trim(),
      options: {
        A: (q.options.A || "").trim(),
        B: (q.options.B || "").trim(),
        C: (q.options.C || "").trim(),
        D: (q.options.D || "").trim(),
      },
      correct: q.correct,
      explanation: q.explanation.trim(),
      topic: (q.topic || "General").trim(),
    };

    verified.push(cleanQuestion);
  }

  return verified;
}

export async function generateKeyPoints(
  pdfText: string,
  bookTitle: string,
  author: string,
  genre: string,
): Promise<KeyPoints> {
  const fallback = buildFallbackKeyPoints(pdfText, bookTitle, author, genre);

  const result = await generateJsonFromPdf({
    pdfText,
    title: bookTitle,
    author,
    genre,
    maxTokens: 2500,
    temperature: 0,
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
