import Book from "../models/Book";
import { reUploadFromURL } from "./geminiPDFService";

export async function processBookAiFromPdfUrl(params: {
  bookId: string;
  pdfUrl: string;
  title: string;
}) {
  const { bookId, pdfUrl, title } = params;

  if (!pdfUrl) {
    await Book.findByIdAndUpdate(bookId, {
      extractionStatus: "no_pdf",
      extractionError: "No PDF URL available",
    });
    return { success: false, skipped: true, reason: "No PDF URL available" };
  }

  await Book.findByIdAndUpdate(bookId, {
    extractionStatus: "uploading",
    extractionError: "",
  });

  const result = await reUploadFromURL(pdfUrl, `${title}.pdf`);

  if (result.success) {
    await Book.findByIdAndUpdate(bookId, {
      geminiFileUri: result.fileUri,
      geminiMimeType: result.mimeType,
      extractionStatus: "ready",
      extractedAt: new Date(),
      extractionError: "",
    });

    return { success: true, fileUri: result.fileUri };
  }

  await Book.findByIdAndUpdate(bookId, {
    extractionStatus: "failed",
    extractionError: result.error || "Upload failed",
  });

  return { success: false, error: result.error || "Upload failed" };
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