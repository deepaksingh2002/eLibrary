import type { BookExtractionStatus } from "../models/Book";

export interface BookAiStatusSource {
  extractionStatus?: string | null;
  pdfUrl?: string | null;
}

const STATUS_SET = new Set<BookExtractionStatus>([
  "pending",
  "uploading",
  "ready",
  "failed",
  "no_pdf",
]);

export function normalizeExtractionStatus(
  book: BookAiStatusSource,
): BookExtractionStatus {
  const status = book.extractionStatus;

  if (
    status === "uploading" ||
    status === "ready" ||
    status === "failed" ||
    status === "no_pdf"
  ) {
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