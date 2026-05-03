import { SortOrder } from "mongoose";
import Book, { IBook } from "../models/Book";
import { UserActivity } from "../models/UserActivity";
import { deleteFromCloudinary, generateSignedUrl, uploadBufferToCloudinary } from "../config/cloudinary";
import { ApiError } from "../utils/ApiError";
import { summarizePdfBook } from "./claudeService";

type AuthUser = {
  id: string;
  role: "admin" | "user" | "guest";
};

type FilesMap = Record<string, Express.Multer.File[] | undefined>;
type BookStatus = "draft" | "published";

interface BookListQuery {
  page?: string;
  limit?: string;
  genre?: string;
  language?: string;
  status?: string;
}

interface BookSearchQuery extends BookListQuery {
  q?: string;
  sort?: string;
}

interface BookPayload {
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
  language?: string;
  tags?: unknown;
  status?: string;
}

const VALID_STATUSES: BookStatus[] = ["draft", "published"];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseStatus(status: unknown): BookStatus {
  const value = parseText(status);
  if (!value) return "draft";

  if (!VALID_STATUSES.includes(value as BookStatus)) {
    throw new ApiError(400, "Status must be draft or published");
  }

  return value as BookStatus;
}

function getPagination(query: BookListQuery): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? "12", 10) || 12));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function parseTags(tags: unknown): string[] {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => String(tag).trim().toLowerCase())
          .filter(Boolean);
      }
    } catch {
      return tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  return [];
}

async function uploadPdf(file: Express.Multer.File): Promise<{ pdfUrl: string; pdfPublicId: string }> {
  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: "elibrary/pdfs",
    resource_type: "raw"
  });

  return {
    pdfUrl: result.secure_url,
    pdfPublicId: result.public_id
  };
}

async function uploadCover(file: Express.Multer.File): Promise<{ coverUrl: string; coverPublicId: string }> {
  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: "elibrary/covers",
    resource_type: "image"
  });

  return {
    coverUrl: result.secure_url,
    coverPublicId: result.public_id
  };
}

function ensureBookFiles(files: FilesMap | undefined): { cover?: Express.Multer.File; pdf?: Express.Multer.File } {
  return {
    cover: files?.cover?.[0],
    pdf: files?.pdf?.[0]
  };
}

export async function listBooks(query: BookListQuery, user?: AuthUser) {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (!user || user.role !== "admin") {
    filter.status = "published";
  } else if (query.status && query.status !== "all") {
    filter.status = query.status;
  }

  if (query.genre) {
    filter.genre = { $regex: escapeRegex(query.genre), $options: "i" };
  }

  if (query.language) {
    filter.language = query.language;
  }

  const [books, total] = await Promise.all([
    Book.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "name email")
      .lean(),
    Book.countDocuments(filter)
  ]);

  return {
    books,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1
  };
}

export async function searchBooks(query: BookSearchQuery) {
  const { page, limit, skip } = getPagination(query);
  const q = parseText(query.q);
  const sort = query.sort ?? "relevance";

  const filter: Record<string, unknown> = {
    status: "published",
    isDeleted: false
  };

  if (query.genre) {
    filter.genre = { $regex: escapeRegex(query.genre), $options: "i" };
  }

  if (query.language) {
    filter.language = { $regex: escapeRegex(query.language), $options: "i" };
  }

  const sortMap: Record<string, Record<string, SortOrder> | { score: { $meta: "textScore" } }> = {
    downloads: { downloads: -1 },
    rating: { avgRating: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    relevance: { score: { $meta: "textScore" } }
  };

  let books: unknown[] = [];
  let total = 0;

  if (q) {
    const textFilter = { ...filter, $text: { $search: q } };
    const sortOption = sort === "relevance" ? sortMap.relevance : (sortMap[sort] ?? { createdAt: -1 });

    [books, total] = await Promise.all([
      Book.find(textFilter, { score: { $meta: "textScore" } })
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate("uploadedBy", "name")
        .lean(),
      Book.countDocuments(textFilter)
    ]);
  } else {
    const sortOption = (sortMap[sort] ?? { createdAt: -1 }) as Record<string, SortOrder>;

    [books, total] = await Promise.all([
      Book.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate("uploadedBy", "name")
        .lean(),
      Book.countDocuments(filter)
    ]);
  }

  return {
    books,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    query: q,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1
  };
}

export async function autocompleteBooks(query: { q?: string }) {
  const q = parseText(query.q);
  if (q.length < 2) {
    return { suggestions: [] };
  }

  const suggestions = await Book.find({
    title: { $regex: escapeRegex(q), $options: "i" },
    status: "published",
    isDeleted: false
  })
    .limit(8)
    .select("_id title author coverUrl genre")
    .lean();

  return { suggestions };
}

export async function getBookById(id: string, user?: AuthUser) {
  const filter: Record<string, unknown> = { _id: id, isDeleted: false };
  if (!user || user.role !== "admin") {
    filter.status = "published";
  }

  const book = await Book.findOne(filter)
    .populate("uploadedBy", "name email")
    .lean();

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  if (user) {
    setImmediate(() => {
      UserActivity.create({
        userId: user.id,
        bookId: id,
        eventType: "view"
      }).catch(() => undefined);
    });
  }

  return { book };
}

export async function createBook(payload: BookPayload, files: FilesMap | undefined, user: AuthUser) {
  const title = parseText(payload.title);
  const author = parseText(payload.author);
  const description = parseText(payload.description);
  const genre = parseText(payload.genre);
  const language = parseText(payload.language) || "en";
  const status = parseStatus(payload.status);
  const parsedTags = parseTags(payload.tags);
  const { cover, pdf } = ensureBookFiles(files);

  if (!title) throw new ApiError(400, "Title is required");
  if (!author) throw new ApiError(400, "Author is required");
  if (!genre) throw new ApiError(400, "Genre is required");
  if (!pdf) throw new ApiError(400, "PDF file is required");

  const uploadedResources: Array<{ publicId: string; resourceType: "image" | "raw" }> = [];

  try {
    const pdfResult = await uploadPdf(pdf);
    uploadedResources.push({ publicId: pdfResult.pdfPublicId, resourceType: "raw" });

    let coverUrl = "";
    let coverPublicId = "";

    if (cover) {
      const coverResult = await uploadCover(cover);
      coverUrl = coverResult.coverUrl;
      coverPublicId = coverResult.coverPublicId;
      uploadedResources.push({ publicId: coverPublicId, resourceType: "image" });
    }

    const book = await Book.create({
      title,
      author,
      description,
      genre,
      language,
      tags: parsedTags,
      coverUrl,
      coverPublicId,
      pdfUrl: pdfResult.pdfUrl,
      pdfPublicId: pdfResult.pdfPublicId,
      status,
      uploadedBy: user.id
    });

    return { message: "Book created successfully", book };
  } catch (error) {
    await Promise.all(
      uploadedResources.map((resource) =>
        deleteFromCloudinary(resource.publicId, resource.resourceType)
      )
    );

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, "Failed to create book");
  }
}

export async function updateBook(id: string, payload: BookPayload, files: FilesMap | undefined) {
  const book = await Book.findOne({ _id: id, isDeleted: false });
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  const title = parseText(payload.title);
  const author = parseText(payload.author);
  const genre = parseText(payload.genre);
  const language = parseText(payload.language);

  if (payload.title !== undefined && !title) throw new ApiError(400, "Title is required");
  if (payload.author !== undefined && !author) throw new ApiError(400, "Author is required");
  if (payload.genre !== undefined && !genre) throw new ApiError(400, "Genre is required");

  if (payload.title !== undefined) book.title = title;
  if (payload.author !== undefined) book.author = author;
  if (payload.description !== undefined) book.description = parseText(payload.description);
  if (payload.genre !== undefined) book.genre = genre;
  if (payload.language !== undefined) book.language = language || "en";
  if (payload.status !== undefined) book.status = parseStatus(payload.status);
  if (payload.tags !== undefined) book.tags = parseTags(payload.tags);

  const { cover, pdf } = ensureBookFiles(files);
  let previousCoverPublicId = "";
  let previousPdfPublicId = "";

  try {
    if (cover) {
      const coverResult = await uploadCover(cover);
      previousCoverPublicId = book.coverPublicId;
      book.coverUrl = coverResult.coverUrl;
      book.coverPublicId = coverResult.coverPublicId;
    }

    if (pdf) {
      const pdfResult = await uploadPdf(pdf);
      previousPdfPublicId = book.pdfPublicId;
      book.pdfUrl = pdfResult.pdfUrl;
      book.pdfPublicId = pdfResult.pdfPublicId;
    }

    await book.save();

    await Promise.all([
      previousCoverPublicId ? deleteFromCloudinary(previousCoverPublicId, "image") : Promise.resolve(),
      previousPdfPublicId ? deleteFromCloudinary(previousPdfPublicId, "raw") : Promise.resolve()
    ]);

    return { message: "Book updated successfully", book };
  } catch (error) {
    if (cover && book.coverPublicId && book.coverPublicId !== previousCoverPublicId) {
      await deleteFromCloudinary(book.coverPublicId, "image");
      if (previousCoverPublicId) {
        book.coverPublicId = previousCoverPublicId;
      }
    }

    if (pdf && book.pdfPublicId && book.pdfPublicId !== previousPdfPublicId) {
      await deleteFromCloudinary(book.pdfPublicId, "raw");
      if (previousPdfPublicId) {
        book.pdfPublicId = previousPdfPublicId;
      }
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, "Failed to update book");
  }
}

export async function softDeleteBook(id: string) {
  const book = await Book.findOne({ _id: id, isDeleted: false });
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  book.isDeleted = true;
  await book.save();

  return { message: "Book deleted successfully" };
}

export async function hardDeleteBook(id: string) {
  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  await Promise.all([
    deleteFromCloudinary(book.coverPublicId, "image"),
    deleteFromCloudinary(book.pdfPublicId, "raw")
  ]);

  await Book.findByIdAndDelete(id);

  return { message: "Book permanently deleted" };
}

export async function toggleBookStatus(id: string) {
  const book = await Book.findOne({ _id: id, isDeleted: false });
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  book.status = book.status === "published" ? "draft" : "published";
  await book.save();

  return {
    message: `Book ${book.status === "published" ? "published" : "moved to draft"} successfully`,
    book
  };
}

export async function downloadBook(id: string, user: AuthUser) {
  console.log(`[Download] User ${user.id} requesting download for book ${id}`);
  
  const book = await Book.findOne({
    _id: id,
    isDeleted: false,
    status: "published"
  });

  if (!book) {
    console.error(`[Download] Book not found: ${id}`);
    throw new ApiError(404, "Book not found");
  }

  if (!book.pdfUrl) {
    console.error(`[Download] PDF URL missing for book ${id}`);
    throw new ApiError(404, "PDF not available for this book");
  }

  let downloadUrl: string;

  try {
    if (book.pdfPublicId) {
      console.log(`[Download] Attempting to generate signed URL for publicId: ${book.pdfPublicId}`);
      downloadUrl = generateSignedUrl(book.pdfPublicId);
      
      if (!downloadUrl) {
        console.warn(`[Download] Signed URL generation failed or returned empty, falling back to direct pdfUrl`);
        downloadUrl = book.pdfUrl;
      }
    } else {
      console.warn(`[Download] pdfPublicId missing for book ${id}, using direct pdfUrl`);
      downloadUrl = book.pdfUrl;
    }
    
    // Ensure PDF download format by adding proper parameters
    if (downloadUrl && !downloadUrl.includes("dl=1")) {
      // Add dl=1 to Cloudinary URLs to force download
      if (downloadUrl.includes("cloudinary.com")) {
        downloadUrl = downloadUrl.includes("?") 
          ? downloadUrl + "&fl=attachment&dl=1"
          : downloadUrl + "?fl=attachment&dl=1";
      }
    }
    
    // Final validation
    if (!downloadUrl) {
      console.error(`[Download] Failed to get any download URL for book ${id}`);
      throw new ApiError(500, "Failed to generate download URL");
    }
    
    console.log(`[Download] Successfully generated download URL for book ${id}, URL length: ${downloadUrl.length}`);

    // Record download activity and increment download counter (non-blocking)
    setImmediate(() => {
      Promise.all([
        Book.findByIdAndUpdate(id, { $inc: { downloads: 1 } }),
        UserActivity.create({
          userId: user.id,
          bookId: id,
          eventType: "download"
        })
      ]).catch(err => console.error("[Download] Failed to update download stats:", err));
    });

    return {
      downloadUrl,
      fileName: `${book.title.replace(/\s+/g, "-")}.pdf`,
      expiresIn: 600
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Download] Unexpected error for book ${id}:`, message);
    throw new ApiError(500, "Failed to process download request");
  }
}

export async function summarizeBook(id: string) {
  const book = await Book.findOne({
    _id: id,
    isDeleted: false,
    status: "published"
  }).lean();

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  const pdfUrl = book.pdfPublicId ? generateSignedUrl(book.pdfPublicId) : book.pdfUrl;

  const summary = await summarizePdfBook({
    title: book.title,
    author: book.author,
    genre: book.genre,
    description: book.description,
    tags: book.tags,
    pdfUrl
  });

  return {
    bookId: book._id,
    title: book.title,
    provider: "gemini",
    ...summary
  };
}
