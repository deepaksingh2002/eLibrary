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
import buildSummaryPrompt, { SUMMARY_SYSTEM_PROMPT } from "../prompts/summaryPrompts";
import buildKeyPointsPrompt, { KEYPOINTS_SYSTEM_PROMPT } from "../prompts/highlightsPrompts";

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

function compactMCQText(text: string): string {
  return normalizeWhitespace(text)
    .replace(/^(?:according to the passage|in the passage|this chapter|the chapter|the text|the book)\b[\s,:;-]*/i, "")
    .replace(/^(?:the passage|the chapter|the text|the book)\b[\s,:;-]*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.?!:;]+$/g, "")
    .trim();
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

const CONVERSATIONAL_BANNED: RegExp[] = [
  /\bsteal\b/i,
  /\bstereo\b/i,
  /\bguitar\b/i,
  /\bfriends?\b/i,
  /\bboyfriend\b/i,
  /\bgirlfriend\b/i,
  /\brestaurant\b/i,
  /\bhotel\b/i,
  /\bsign up\b/i,
  /\ball chapters?\b/i,
  /table of contents/i,
]

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

  // use the global banned conversational patterns
  const conversationalBanned = CONVERSATIONAL_BANNED

  for (const sentence of blocks) {
    const fact = shortenText(sentence, 150)
    // filter out conversational or clearly unrelated sentences
    if (conversationalBanned.some((rx) => rx.test(fact))) continue
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
    const correctFull = compactMCQText(fact.fact)
    const correctKey = normalizeQuestionKey(correctFull)
    if (!correctFull || usedCorrect.has(correctKey)) continue
    usedCorrect.add(correctKey)

    // sanitize topic to avoid headings like "Chapter 1: Chapter 1" leaking into questions
    function sanitizeTopic(input?: string | null): string {
      if (!input) return "the passage"
      let s = String(input).trim()
      // remove leading chapter markers like "Chapter 1:", "CHAPTER 1 -", etc.
      s = s.replace(/^chapter\s*\d+\s*[:\-–]\s*/i, "")
      // remove any remaining standalone 'Chapter 1' tokens
      s = s.replace(/\bchapter\s*\d+\b/ig, "").trim()
      s = s.replace(/^(talks about|describes|explains|shows|covers|introduces|examines|focuses on)\s+/i, "")
      s = s.replace(/\b(and|while|because|where|when|as)\b.*$/i, "")
      s = s.replace(/[.;:!?].*$/, "")
      // collapse obvious repeated phrases like "Intro Intro" -> "Intro"
      const dup = s.match(/^(.+?)\s*[:\-–]?\s*\1(?:[:\-–]|\s*)*$/i)
      if (dup && dup[1]) s = dup[1].trim()
      if (!s) return "the passage"
      return s
    }

    let topicForQuestion = sanitizeTopic(chapterFocus || fact.topic || "the passage")
    // avoid leaking an 'All chapters' label into the question phrasing
    if (/all chapters?/i.test(topicForQuestion)) topicForQuestion = "the passage"
    const question = questionTemplates[i % questionTemplates.length](topicForQuestion)
    const questionKey = normalizeQuestionKey(question)
    if (usedQuestions.has(questionKey)) continue
    usedQuestions.add(questionKey)

    // prefer distractors that share topic tokens but are not identical
    const topicTokens = topicForQuestion
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3)

    const candidateDistractors = facts
      .filter((candidate) => normalizeQuestionKey(candidate.fact) !== correctKey)
      .filter((candidate) => !CONVERSATIONAL_BANNED.some((rx: RegExp) => rx.test(candidate.fact)))
      .map((candidate) => ({
        text: compactMCQText(candidate.fact),
        sim: topicTokens.reduce((acc, tk) => acc + (candidate.topic.toLowerCase().includes(tk) ? 1 : 0), 0),
      }))
      .filter((c) => c.text && c.text.length > 12)
      .sort((a, b) => b.sim - a.sim || a.text.length - b.text.length)

    const distractors = Array.from(new Set(candidateDistractors.map((c) => c.text))).slice(0, 3)

    while (distractors.length < 3) {
      const filler = chapterFocus
        ? compactMCQText(`A different detail from the passage`)
        : compactMCQText(`A different detail from the passage`)
      if (!distractors.includes(filler)) distractors.push(filler)
      else break
    }

    // sanitize and shorten options to keep them concise
    const optionsRaw = [correctFull, ...distractors].slice(0, 4).map((o) => compactMCQText(String(o)))
    const options = shuffleWithSeed(optionsRaw, `${bookTitle || "fallback"}:${question}:${i}`)
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
  let normalized = normalizeWhitespace(title)
    .replace(/^(chapter|chap\.?|section|part)\s+([0-9ivxlcdm]+[\s.:\-]*)?/i, "")
    .replace(/^\d+[\s.:\-]*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.·•\-–—]+$/g, "")
    .trim();

  const proseFragment = normalized.match(/^(talks about|describes|explains|shows|covers|introduces|examines|focuses on)\s+(.+)$/i)
  if (proseFragment?.[2]) {
    normalized = proseFragment[2]
      .replace(/\b(and|while|because|where|when|as)\b.*$/i, "")
      .replace(/[.;:!?].*$/, "")
      .trim();
  }

  return normalized.replace(/\s{2,}/g, " ").trim();
}

function looksLikeChapterTitle(title: string): boolean {
  const normalized = normalizeWhitespace(title).replace(/\s{2,}/g, " ").trim();
  if (!normalized || normalized.length < 3 || normalized.length > 90) {
    return false;
  }

  const lower = normalized.toLowerCase();
  const wordCount = normalized.split(/\s+/).length;

  if (
    /^(contents|table of contents|brief contents|index|preface|dedication|acknowledg(e)?ments|foreword|bibliography|references|works cited|appendices?)$/i.test(normalized) ||
    /\b(talks about|describes|explains|shows how|shows|covers|introduces|examines|focuses on)\b/i.test(lower) ||
    /[\[\]{}=<>|#@]/.test(normalized) ||
    /[?;]/.test(normalized) ||
    wordCount > 12 ||
    /\b(?:if you|you can|you will|you may|i'll|i will|we will|we can|this chapter|in this book|the book|the text)\b/i.test(lower)
  ) {
    return false;
  }

  return true;
}

export function sanitizeChapterRanges(
  chapters: ChapterRange[],
  totalPages?: number,
): ChapterRange[] {
  const cleaned = chapters
    .map((chapter) => ({
      number: Number.isFinite(Number(chapter.number)) ? Number(chapter.number) : 0,
      title: normalizeWhitespace(String(chapter.title || "")).replace(/\s{2,}/g, " ").trim(),
      startPage: Number.isFinite(Number(chapter.startPage)) ? Number(chapter.startPage) : 1,
      endPage: Number.isFinite(Number(chapter.endPage)) ? Number(chapter.endPage) : Number(chapter.startPage) || 1,
    }))
    .filter((chapter) => looksLikeChapterTitle(chapter.title))
    .filter((chapter) => chapter.startPage >= 1)
    .sort((left, right) => left.startPage - right.startPage || left.title.localeCompare(right.title))

  const deduped = Array.from(
    new Map(cleaned.map((chapter) => [`${chapter.startPage}:${chapter.title.toLowerCase()}`, chapter])).values(),
  )

  const fallbackEndPage = totalPages && totalPages > 0 ? totalPages : undefined

  return deduped.map((chapter, index, items) => ({
    number: chapter.number > 0 ? chapter.number : index + 1,
    title: chapter.title,
    startPage: chapter.startPage,
    endPage: Math.max(
      chapter.startPage,
      Math.min(
        chapter.endPage,
        (items[index + 1]?.startPage || (fallbackEndPage ? fallbackEndPage + 1 : chapter.startPage + 1)) - 1,
      ),
    ),
  }))
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
        /^\s*(chapter|chap|part|appendix)\s+[0-9ivxlcdm]+\b/i,
        /^\s*\d+\s+[A-Z][a-zA-Z0-9\s,:'\-]{4,100}$/, // Strict: no dots, no brackets, starts with number followed by space then capital letter
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

  const sanitized = sanitizeChapterRanges(
    deduped.map((entry, index) => ({
      number: index + 1,
      title: entry.title,
      startPage: entry.startPage,
      endPage: entry.startPage,
    })),
    totalPages,
  );

  if (sanitized.length < 2) {
    return [];
  }

  // Find back matter start page
  let backMatterStartPage: number | null = null;
  const backMatterPatterns = [
    /^\s*index\s*$/i,
    /^\s*subject index\s*$/i,
    /^\s*author index\s*$/i,
    /^\s*bibliography\s*$/i,
    /^\s*references\s*$/i,
    /^\s*works cited\s*$/i,
  ];

  for (const page of pages) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean).slice(0, 5);
    const hasBackMatter = lines.some((line) => backMatterPatterns.some((pat) => pat.test(line)));
    if (hasBackMatter) {
      backMatterStartPage = page.pageNumber;
      break;
    }
  }

  const contentEndPage = backMatterStartPage ? backMatterStartPage - 1 : totalPages;

  return sanitized.map((entry, index) => ({
    ...entry,
    endPage: Math.max(
      entry.startPage,
      Math.min(
        entry.endPage,
        (sanitized[index + 1]?.startPage || (contentEndPage > 0 ? contentEndPage + 1 : entry.startPage + 1)) - 1,
      ),
    ),
  }));
}

export async function extractChapterIndexFromPagesAsync(
  pages: Array<{ pageNumber: number; text: string }>,
  totalPages: number,
  title?: string,
): Promise<ChapterRange[]> {
  // Try LangChain-based TOC extraction using the first 15 pages as context
  const snippet = pages
    .slice(0, Math.min(pages.length, 15))
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join("\n\n")
    .slice(0, 45000);

  try {
    const result = await generateJsonFromPdf({
      pdfText: snippet,
      title: title || "",
      author: "",
      genre: "",
      maxTokens: 1000,
      prompt: `Find the table of contents or brief contents section in the PDF content provided.
Extract all actual content chapters and their starting page numbers.

Return ONLY valid JSON with the following shape:
{
  "chapters": [
    { "number": 1, "title": "Chapter title text", "startPage": 12 }
  ]
}

Rules:
- Identify the exact page numbers from the [Page X] tags.
- Return at most 30 chapters.
- Only include actual content chapters or sections. Do not include Preface, Title page, Table of Contents, Acknowledgments, Dedication, Index, Bibliography, or generic step-by-step lists.`,
    });

    if (result.success && result.text) {
      try {
        const parsed = parseJSON(result.text);
        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length > 1) {
          const chapters: ChapterRange[] = sanitizeChapterRanges(
            parsed.chapters
            .map((c: any, idx: number) => ({
              number: Number.isFinite(Number(c.number)) ? Number(c.number) : idx + 1,
              title: normalizeTocTitle(String(c.title || `Chapter ${idx + 1}`)),
              startPage: Number.isFinite(Number(c.startPage)) ? Number(c.startPage) : 1,
            })),
            totalPages,
          );

          if (chapters.length > 1) return chapters;
        }
      } catch (err) {
        console.error("[LangChain] TOC parse error:", (err as any)?.message || err);
      }
    }
  } catch (err: any) {
    console.error("[LangChain] TOC extraction failed:", err?.message || err);
  }

  // Fallback to quick heuristic if LLM TOC extraction fails or returns too few chapters
  return extractChapterIndexFromPages(pages, totalPages);
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
    prompt: buildSummaryPrompt(),
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
  if (chunks.length === 0) {
    console.warn("[MCQ] No chunks generated from PDF text");
    return { questions: [], fallbackUsed: false };
  }
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
Your ONLY job is to create concise, chapter-specific quiz questions from the provided text.

CRITICAL RULES — FOLLOW EXACTLY:
1. ONLY create questions about content in the TEXT BELOW.
2. If a question cannot be answered from the text, SKIP IT.
3. NEVER use general knowledge, Wikipedia, or training data.
4. Every correct answer MUST appear in or be directly inferable from the TEXT BELOW.
5. Never reuse the chapter title, section heading, or TOC wording as a question stem.
6. Never include fragmentary prose like "talks about", "describes", or "shows how" in the question.
7. Write one complete grammatical sentence ending with a question mark.
8. Keep answer choices plausible, distinct, and fully written out. Do not abbreviate or truncate them.
9. If the source text begins with a heading or opener sentence, ignore it when forming the question.
10. Favor direct stems such as "What is...", "Why does...", "How does...", or "What happens when...".
11. Avoid generic stems like "Which statement about...", "According to the passage...", or "What does the passage indicate...?".

Book: "{title}"
Chunk {chunkNum} of {totalChunks}

TEXT TO USE (and ONLY this text):
===START===
{text}
===END===

Generate exactly {needed} multiple choice questions from the TEXT ABOVE ONLY.

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

function isSemanticHeading(line: string): boolean {
  const normalized = normalizeWhitespace(line)
  if (!normalized || normalized.length < 4 || normalized.length > 120) return false

  if (/^(chapter|chap\.?|section|part)\s+[0-9ivxlcdm]+\b/i.test(normalized)) return true
  if (/^[0-9]+(?:\.[0-9]+)*\s+[A-Z]/.test(normalized)) return true
  if (/^[A-Z0-9][A-Z0-9\s,:;'"-]{3,}$/.test(normalized) && normalized.split(/\s+/).length <= 10) return true

  return false
}

function splitIntoSemanticBlocks(text: string): string[] {
  const blocks: string[] = []
  let current: string[] = []

  for (const rawLine of normalizeWhitespace(text)
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n+/)) {
    const line = normalizeWhitespace(rawLine)
    if (!line) continue

    if (isSemanticHeading(line) && current.length > 0) {
      blocks.push(current.join(" ").trim())
      current = [line]
      continue
    }

    current.push(line)
    if (line.endsWith(":") || line.endsWith(".") && current.join(" ").length > 260) {
      blocks.push(current.join(" ").trim())
      current = []
    }
  }

  if (current.length > 0) {
    blocks.push(current.join(" ").trim())
  }

  return blocks.filter(Boolean)
}

function packSemanticBlocks(blocks: string[], targetSize: number): string[] {
  const chunks: string[] = []
  let current: string[] = []
  let currentLength = 0

  const flush = () => {
    const chunk = current.join("\n\n").trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    current = []
    currentLength = 0
  }

  for (const block of blocks) {
    if (current.length > 0 && currentLength + block.length + 2 > targetSize) {
      flush()
    }

    current.push(block)
    currentLength += block.length + (current.length > 1 ? 2 : 0)

    if (block.length >= targetSize) {
      flush()
    }
  }

  if (current.length > 0) {
    flush()
  }

  return chunks
}

// Split text into semantic chunks aligned to sections and paragraphs.
function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const semanticBlocks = splitIntoSemanticBlocks(text)
  const chunks = packSemanticBlocks(semanticBlocks.length > 0 ? semanticBlocks : [normalizeWhitespace(text)], chunkSize)
  return chunks.filter((chunk) => chunk.length > 200)
}

function verifyMCQAnswers(questions: any[], sourceText: string): MCQQuestion[] {
  const verified: MCQQuestion[] = [];
  const lowerSource = sourceText.toLowerCase();

  function hasSubstringMatch(text: string, source: string, minLen = 12): boolean {
    if (!text || text.length < minLen) return false;
    const normalized = normalizeWhitespace(text).toLowerCase();
    for (let i = 0; i + minLen <= normalized.length; i += 1) {
      const sub = normalized.slice(i, i + minLen);
      if (source.includes(sub)) return true;
    }
    return false;
  }

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
    // Require stronger grounding to reduce hallucinated/irrelevant questions
    if (groundingRatio < 0.45) {
      console.log("[MCQ] Rejected (not grounded):", q.question.slice(0, 60), "ratio:", groundingRatio.toFixed(2));
      continue;
    }

    // Ensure the correct option or explanation has a substring match in the source text
    const correctOption = (q.options && q.options[q.correct]) ? String(q.options[q.correct]) : "";
    const explanation = String(q.explanation || "");
    const hasMatch = hasSubstringMatch(correctOption, lowerSource, 12) || hasSubstringMatch(explanation, lowerSource, 16);
    if (!hasMatch) {
      console.log("[MCQ] Rejected (no source match for correct option/explanation):", q.question.slice(0, 60));
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

// export helper for unit tests
export const _testable = {
  verifyMCQAnswers,
  isGenericMCQQuestion,
  compactMCQText,
};

export async function generateKeyPointsForChapter(
  chapterText: string,
  bookTitle: string,
  chapterTitle: string,
  chapterNumber: number,
): Promise<{
  number: number;
  title: string;
  points: string[];
  glossary: Array<{ term: string; definition: string }>;
  takeaways: string[];
  examTips: string[];
  interviewTopics: string[];
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: 2000,
  } as any);

  const parser = new StringOutputParser();
  const prompt = PromptTemplate.fromTemplate(`
You are an expert academic assistant.
Your job is to analyze the text of a single chapter from the book "{bookTitle}" and generate study materials.

Chapter Title: "{chapterTitle}" (Chapter Number: {chapterNumber})

TEXT TO USE:
===START===
{text}
===END===

Extract the following from the TEXT ABOVE ONLY:
1. 3-5 key points/highlights of this chapter.
2. 2-4 important glossary terms with their definitions from this chapter.
3. 1-2 practical takeaways.
4. 1-2 exam tips (specific facts/formulas likely to be tested).
5. 1-2 interview topics (conceptual questions with answers/explanations).

Return ONLY this JSON (no markdown, no extra text):
{{
  "points": [
    "Key fact or concept from this chapter",
    "Second important point"
  ],
  "glossary": [
    {{
      "term": "Technical term",
      "definition": "Definition as used in this chapter"
    }}
  ],
  "takeaways": [
    "Practical insight from this chapter's content"
  ],
  "examTips": [
    "Specific exam-critical item"
  ],
  "interviewTopics": [
    "Technical concept or question asked in interviews"
  ]
}}
`);

  const chain = RunnableSequence.from([prompt, model, parser]);
  const resultText = await chain.invoke({
    bookTitle,
    chapterTitle,
    chapterNumber: chapterNumber.toString(),
    text: chapterText.slice(0, 40000),
  });

  const parsed = parseJSON(String(resultText));

  return {
    number: chapterNumber,
    title: chapterTitle,
    points: Array.isArray(parsed.points) ? parsed.points : [],
    glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
    takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
    examTips: Array.isArray(parsed.examTips) ? parsed.examTips : [],
    interviewTopics: Array.isArray(parsed.interviewTopics) ? parsed.interviewTopics : [],
  };
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
    prompt: buildKeyPointsPrompt(),
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
