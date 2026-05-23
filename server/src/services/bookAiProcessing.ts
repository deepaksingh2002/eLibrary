import Book from "../models/Book";

export async function processBookAiFromPdfUrl(params: {
  bookId: string;
  pdfUrl: string;
  title: string;
}) {
  const { bookId, pdfUrl } = params;

  if (!pdfUrl) {
    await Book.findByIdAndUpdate(bookId, {
      extractionStatus: "no_pdf",
      extractionError: "No PDF URL available",
    });
    return { success: false, skipped: true, reason: "No PDF URL available" };
  }

  await Book.findByIdAndUpdate(bookId, {
    extractionStatus: "ready",
    extractionError: "",
    extractedAt: new Date(),
  });

  return { success: true, ready: true };
}

export function scheduleBookAiProcessing(params: {
  bookId: string;
  pdfUrl: string;
  title: string;
}) {
  setImmediate(() => {
    processBookAiFromPdfUrl(params).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[BookAI] Processing error:", params.bookId, message);
    });
  });
}