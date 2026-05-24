import type { BookExtractionStatus } from "../models/Book";

export interface BookAiStatusSource {
  extractionStatus?: string | null;
  pdfUrl?: string | null;
  pdfTextExtracted?: boolean | null;
  extractedAt?: Date | string | null;
  extractionError?: string | null;
}

const STATUS_SET = new Set<BookExtractionStatus>([
  "pending",
  "processing",
  "ready",
  "failed",
  "no_pdf",
]);

export function normalizeExtractionStatus(
  book: BookAiStatusSource,
): BookExtractionStatus {
  const status = book.extractionStatus;

  const extractionCompleted =
    book.pdfTextExtracted === true ||
    !!book.extractedAt;

  const extractionFailed =
    typeof book.extractionError === "string" && book.extractionError.trim().length > 0;

  if (
    status === "processing" ||
    status === "ready" ||
    status === "failed" ||
    status === "no_pdf"
  ) {
    if (status === "processing") {
      if (extractionFailed) {
        return "failed";
      }

      if (extractionCompleted) {
        return "ready";
      }
    }

    return status;
  }

  if (status && STATUS_SET.has(status as BookExtractionStatus)) {
    return status as BookExtractionStatus;
  }

  if (book.pdfUrl) {
    return "ready";
  }

  return "no_pdf";
}