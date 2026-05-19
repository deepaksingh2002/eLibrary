import { Router } from "express"
import { protect } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/rbac.middleware"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/ApiError"
import Book from "../models/Book"
import { searchBooksOnline, getGoogleBookById, type ExternalBookResult } from "../services/bookSearchService"
import { buildBaseEnhancedBookData, enhanceBookMetadata, enhanceBatch } from "../services/bookMetadataEnhancer"

const router = Router();

function limitText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeGenre(value: unknown): string {
  const genre = limitText(value, 100);
  return genre || "Other";
}

function normalizeLanguage(value: unknown): string {
  const language = limitText(value, 20);
  return language || "en";
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => limitText(tag, 60).toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImportSource(value: unknown): "manual" | "google_books" | "open_library" | "smart_import" | "bulk_json" | "dbooks" {
  const source = limitText(value, 30);
  if (source === "google_books" || source === "open_library" || source === "smart_import" || source === "bulk_json" || source === "dbooks") {
    return source;
  }

  return "smart_import";
}

router.use(protect, requireRole("admin"));

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { q, limit = "12" } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      throw new ApiError(400, "Search query must be at least 2 characters");
    }

    const limitNum = Math.min(20, Math.max(1, parseInt(limit as string, 10) || 12))

    const rawResults = await searchBooksOnline(q.trim(), limitNum)

    if (rawResults.length === 0) {
      return res.json({ results: [], total: 0, query: q, message: "No books found for this query" });
    }

    const toEnhance = rawResults.slice(0, 6);
    const rest = rawResults.slice(6);

    const [enhanced, basicRest] = await Promise.all([
      enhanceBatch(toEnhance),
      Promise.all(rest.map((book: ExternalBookResult) => Promise.resolve(buildBaseEnhancedBookData(book))))
    ])

    const allResults = [...enhanced, ...basicRest];

    const existingCheck = await Promise.all(
      allResults.map(async (book) => {
        const filter = book.isbn
          ? { isbn: book.isbn, isDeleted: false }
          : {
              title: {
                $regex: `^${book.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                $options: "i"
              },
              isDeleted: false
            };

        const exists = await Book.exists(filter);
        return { ...book, alreadyExists: !!exists };
      })
    );

    console.log(`[SmartImport] Found ${existingCheck.length} results for "${q}"`);

    res.json({ results: existingCheck, total: existingCheck.length, query: q });
  })
);

router.get(
  "/details/:googleId",
  asyncHandler(async (req, res) => {
    const { googleId } = req.params;

    const raw = await getGoogleBookById(googleId);
    if (!raw) {
      throw new ApiError(404, "Book not found on Google Books");
    }

    const enhanced = await enhanceBookMetadata(raw);
    res.json({ book: enhanced });
  })
);

router.post(
  "/add",
  asyncHandler(async (req, res) => {
    const {
      title,
      author,
      description,
      genre,
      language,
      tags,
      coverUrl,
      pdfUrl,
      pageCount,
      publishedYear,
      publisher,
      isbn,
      externalId,
      source,
      status = "draft"
    } = req.body;

    if (!title?.trim()) throw new ApiError(400, "Title is required");
    if (!author?.trim()) throw new ApiError(400, "Author is required");

    const existing = isbn
      ? await Book.findOne({ isbn, isDeleted: false })
      : await Book.findOne({
          title: { $regex: `^${title.trim()}$`, $options: "i" },
          author: { $regex: author.trim(), $options: "i" },
          isDeleted: false
        });

    if (existing) {
      throw new ApiError(409, `"${title}" by ${author} already exists in the library`);
    }

    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
      description: limitText(description, 2000),
      genre: normalizeGenre(genre),
      language: normalizeLanguage(language),
      tags: normalizeTags(tags),
      coverUrl: coverUrl || "",
      coverPublicId: "",
      pdfUrl: pdfUrl || "",
      pdfPublicId: "",
      status: status === "published" ? "published" : "draft",
      uploadedBy: req.user!.id,
      downloads: 0,
      avgRating: 0,
      totalReviews: 0,
      pageCount: normalizeNumber(pageCount, 0),
      publishedYear: limitText(publishedYear, 8),
      publisher: limitText(publisher, 200),
      isbn: limitText(isbn, 32),
      importSource: normalizeImportSource(source),
      externalId: externalId || ""
    });

    res.status(201).json({
      message: "Book added to library successfully",
      book,
      hasPdf: !!pdfUrl,
      needsPdf: !pdfUrl,
      editUrl: `/admin/books/${book._id}/edit`
    });
  })
);

router.post(
  "/add-batch",
  asyncHandler(async (req, res) => {
    const { books } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
      throw new ApiError(400, "Books array is required");
    }
    if (books.length > 20) {
      throw new ApiError(400, "Maximum 20 books per batch import");
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as { title: string; reason: string }[]
    };

    for (const bookData of books) {
      try {
        const exists = await Book.findOne({
          title: { $regex: `^${bookData.title}$`, $options: "i" },
          isDeleted: false
        });

        if (exists) {
          results.skipped++;
          results.errors.push({ title: bookData.title, reason: "Already exists in library" });
          continue;
        }

        await Book.create({
          title: bookData.title?.trim() || "Unknown",
          author: bookData.author?.trim() || "Unknown",
          description: limitText(bookData.description, 2000),
          genre: normalizeGenre(bookData.genre),
          language: normalizeLanguage(bookData.language),
          tags: normalizeTags(bookData.tags),
          coverUrl: bookData.coverUrl || "",
          pdfUrl: bookData.pdfUrl || "",
          coverPublicId: "",
          pdfPublicId: "",
          status: "draft",
          uploadedBy: req.user!.id,
          isbn: limitText(bookData.isbn, 32),
          importSource: normalizeImportSource(bookData.source),
          externalId: bookData.externalId || ""
        });

        results.imported++;
      } catch (error: any) {
        results.errors.push({
          title: bookData.title || "Unknown",
          reason: error?.message || "Failed to create"
        });
      }
    }

    res.json({
      message: `${results.imported} books imported, ${results.skipped} skipped`,
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors
    });
  })
);

export default router;