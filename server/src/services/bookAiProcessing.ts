import Book from "../models/Book";
import { ensureBookVectorIndex } from "./bookVectorService";

export async function processBookAiFromPdfUrl(params: {
  bookId: string;
  pdfUrl: string;
  title: string;
  force?: boolean;
}) {
  const { bookId, pdfUrl, force = false } = params;

  const book = await Book.findById(bookId)
    .select("title author genre description pdfUrl")
    .lean();

  if (!book) {
    return { success: false, skipped: true, reason: "Book not found" };
  }

  const resolvedPdfUrl = book.pdfUrl || pdfUrl;

  if (!resolvedPdfUrl) {
    await Book.findByIdAndUpdate(bookId, {
      extractionStatus: "no_pdf",
      extractionError: "No PDF URL available",
    });
    return { success: false, skipped: true, reason: "No PDF URL available" };
  }

  const result = await ensureBookVectorIndex(
    {
      _id: bookId,
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description || "",
      pdfUrl: resolvedPdfUrl,
    },
    { force },
  )

  return {
    success: result.success,
    ready: result.success,
    pages: result.pages,
    chunks: result.chunks,
    error: result.error,
  };
}

export function scheduleBookAiProcessing(params: {
  bookId: string;
  pdfUrl: string;
  title: string;
  force?: boolean;
}) {
  setImmediate(() => {
    processBookAiFromPdfUrl(params).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[BookAI] Processing error:", params.bookId, message);
    });
  });
}