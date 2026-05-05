/**
 * Shared utility functions used across the frontend
 */

/**
 * Build page numbers for pagination UI
 * Returns array of page numbers with proper spacing
 */
export function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (let index = currentPage - 2; index <= currentPage + 2; index += 1) {
    if (index > 1 && index < totalPages) {
      pages.add(index);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Extract error message from axios or generic errors
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as Record<string, unknown>).message;
    return typeof msg === "string" ? msg : "An error occurred";
  }
  return "An unexpected error occurred";
}

/**
 * Extract API error message from response
 */
export function getApiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as { response?: { data?: { message?: unknown } }; message?: unknown };
    if (apiError.response?.data?.message) {
      return String(apiError.response.data.message);
    }
    if (apiError.message) {
      return String(apiError.message);
    }
  }
  return "An unexpected error occurred";
}

/**
 * Trigger file download from blob
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
