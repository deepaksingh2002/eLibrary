import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExternalBookResult } from "./bookSearchService";
import { resolveExternalPdfUrl } from "./externalPdfResolver";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const STANDARD_GENRES = [
  "Programming",
  "Mathematics",
  "Science",
  "Literature",
  "History",
  "Business",
  "Philosophy",
  "Engineering",
  "Medicine",
  "Law",
  "Economics",
  "Psychology",
  "Other",
];

export interface EnhancedBookData {
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string[];
  coverUrl: string;
  pdfUrl: string;
  previewUrl: string;
  pageCount: number;
  publishedYear: string;
  publisher: string;
  isbn: string;
  source: string;
  externalId: string;
  aiEnhanced: boolean;
}

function mapGenreBasic(rawGenre: string): string {
  if (!rawGenre) return "Other";

  const lower = rawGenre.toLowerCase();
  const map: Record<string, string> = {
    computer: "Programming",
    programming: "Programming",
    software: "Programming",
    coding: "Programming",
    mathematics: "Mathematics",
    math: "Mathematics",
    calculus: "Mathematics",
    algebra: "Mathematics",
    statistics: "Mathematics",
    science: "Science",
    physics: "Science",
    chemistry: "Science",
    biology: "Science",
    fiction: "Literature",
    novel: "Literature",
    poetry: "Literature",
    literature: "Literature",
    history: "History",
    historical: "History",
    business: "Business",
    management: "Business",
    economics: "Economics",
    finance: "Business",
    philosophy: "Philosophy",
    engineering: "Engineering",
    medicine: "Medicine",
    medical: "Medicine",
    health: "Medicine",
    law: "Law",
    legal: "Law",
    psychology: "Psychology",
    "self-help": "Psychology",
  };

  for (const [keyword, genre] of Object.entries(map)) {
    if (lower.includes(keyword)) {
      return genre;
    }
  }

  return "Other";
}

function normalizeLanguage(lang: string): string {
  if (!lang) return "en";

  const lower = lang.toLowerCase();
  const map: Record<string, string> = {
    eng: "en",
    en: "en",
    english: "en",
    hin: "hi",
    hi: "hi",
    hindi: "hi",
    spa: "es",
    es: "es",
    spanish: "es",
    fre: "fr",
    fr: "fr",
    french: "fr",
    ger: "de",
    de: "de",
    german: "de",
  };

  return map[lower] || "en";
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

export function buildBaseEnhancedBookData(
  book: ExternalBookResult,
): EnhancedBookData {
  return {
    title: book.title,
    author: book.author,
    description: book.description,
    genre: mapGenreBasic(book.genre),
    language: normalizeLanguage(book.language),
    tags: book.tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean),
    coverUrl: book.coverUrl,
    pdfUrl: book.pdfUrl,
    previewUrl: book.previewUrl,
    pageCount: book.pageCount,
    publishedYear: book.publishedYear,
    publisher: book.publisher,
    isbn: book.isbn,
    source: book.source,
    externalId: book.externalId,
    aiEnhanced: false,
  };
}

export async function enhanceBookMetadata(
  book: ExternalBookResult,
): Promise<EnhancedBookData> {
  const base = buildBaseEnhancedBookData(book);

  if (!process.env.GEMINI_API_KEY) {
    return base;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const prompt = `You are a library cataloguing assistant.
Given this book information, improve the metadata quality.
Return ONLY valid JSON with no markdown formatting.

Book Data:
  Title:       ${book.title}
  Author:      ${book.author}
  Raw Genre:   ${book.genre || "unknown"}
  Description: ${book.description?.slice(0, 500) || "not provided"}
  Tags:        ${book.tags.join(", ") || "none"}
  Language:    ${book.language || "unknown"}

Tasks:
1. Map the raw genre to ONE of these exact options:
   ${STANDARD_GENRES.join(", ")}
   Choose the closest match. Default to "Other" if unsure.

2. If description is empty or less than 50 characters,
   write a 2-3 sentence description based on the title and author.
   Keep it factual and professional.

3. Generate 5-8 relevant lowercase tags for this book.
   Tags should be specific: topic keywords, not just genre words.
   Example: ["algorithms", "data structures", "computer science"]

4. Clean the author name: proper capitalization, remove extra info.

Return this exact JSON structure:
{
  "genre":       "one of the standard genres listed above",
  "description": "improved description text",
  "tags":        ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "author":      "cleaned author name"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(stripMarkdownFences(text));

    return {
      ...base,
      genre: STANDARD_GENRES.includes(parsed.genre) ? parsed.genre : base.genre,
      description:
        typeof parsed.description === "string" && parsed.description.trim()
          ? parsed.description.trim()
          : base.description,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .map((tag: string) => tag.toLowerCase().trim())
            .filter(Boolean)
            .slice(0, 8)
        : base.tags,
      author:
        typeof parsed.author === "string" && parsed.author.trim()
          ? parsed.author.trim()
          : base.author,
      aiEnhanced: true,
    };
  } catch (error: any) {
    console.error(
      "[BookMetadata] AI enhancement failed:",
      error?.message || error,
    );
    return base;
  }
}

export async function enhanceBatch(
  books: ExternalBookResult[],
): Promise<EnhancedBookData[]> {
  const results: EnhancedBookData[] = [];
  const batchSize = 3;

  for (let index = 0; index < books.length; index += batchSize) {
    const batch = books.slice(index, index + batchSize);
    const enhanced = await Promise.all(
      batch.map(async (book) => {
        const result = await enhanceBookMetadata(book);

        // Try to resolve PDF for books without one (especially Google Books)
        if (!result.pdfUrl) {
          try {
            const resolvedPdf = await resolveExternalPdfUrl({
              title: result.title,
              author: result.author,
              isbn: result.isbn,
              importSource: result.source,
              externalId: result.externalId,
              pdfUrl: result.pdfUrl,
            });

            if (resolvedPdf) {
              result.pdfUrl = resolvedPdf;
              console.log(
                `[BookMetadata] Resolved PDF for "${result.title}": ${resolvedPdf.substring(0, 50)}...`,
              );
            }
          } catch (error: any) {
            // Silently continue if PDF resolution fails
          }
        }

        return result;
      }),
    );
    results.push(...enhanced);

    if (index + batchSize < books.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
