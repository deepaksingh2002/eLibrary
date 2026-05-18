"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../../../../../components/ProtectedRoute";
import { toast } from "../../../../../components/ui/Toast";
import { useBulkImportBooksMutation } from "../../../../../store/services/api";
import { getApiErrorMessage } from "../../../../../lib/getApiErrorMessage";
import type { BulkImportResult } from "../../../../../types";

interface BookImportItem {
  title: string;
  author: string;
  genre: string;
  description?: string;
  language?: string;
  tags?: string[];
  pdfUrl: string;
  coverUrl?: string;
  status?: "published" | "draft";
}

interface ImportErrorItem {
  index: number;
  title?: string;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const tags = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return tags.length ? tags : undefined;
  }

  if (typeof value === "string") {
    const tags = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return tags.length ? tags : undefined;
  }

  return undefined;
}

function normalizeStatus(value: unknown): "published" | "draft" {
  return value === "published" ? "published" : "draft";
}

export default function BulkImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedBooks, setParsedBooks] = useState<BookImportItem[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ImportErrorItem[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [bulkImport, { isLoading: isImporting }] = useBulkImportBooksMutation();

  const parseFile = (selectedFile: File) => {
    if (!selectedFile) return;

    setParseError(null);
    setParsedBooks(null);
    setValidationErrors([]);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsed = JSON.parse(result);

        if (!Array.isArray(parsed)) {
          throw new Error("JSON file must contain an array of books");
        }

        if (parsed.length > 100) {
          throw new Error("Maximum 100 books can be imported at once");
        }

        const validBooks: BookImportItem[] = [];
        const nextErrors: ImportErrorItem[] = [];

        parsed.forEach((item, index) => {
          if (!isRecord(item)) {
            nextErrors.push({ index, title: "Unknown", reason: "Row must be an object" });
            return;
          }

          const title = toOptionalString(item.title);
          const author = toOptionalString(item.author);
          const genre = toOptionalString(item.genre);
          const pdfUrl = toOptionalString(item.pdfUrl);
          const missing = [
            !title ? "title" : null,
            !author ? "author" : null,
            !genre ? "genre" : null,
            !pdfUrl ? "pdfUrl" : null,
          ].filter(Boolean);

          if (!title || !author || !genre || !pdfUrl) {
            nextErrors.push({
              index,
              title: title || "Unknown",
              reason: `Missing required fields: ${missing.join(", ")}`,
            });
            return;
          }

          validBooks.push({
            title,
            author,
            genre,
            pdfUrl,
            description: toOptionalString(item.description),
            language: toOptionalString(item.language) || "en",
            tags: normalizeTags(item.tags),
            coverUrl: toOptionalString(item.coverUrl),
            status: normalizeStatus(item.status),
          });
        });

        if (validBooks.length === 0) {
          throw new Error("No valid books found. Each book needs title, author, genre, and pdfUrl");
        }

        setParsedBooks(validBooks);
        setValidationErrors(nextErrors);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse JSON file";
        setParseError(message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) parseFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const selectedFile = event.dataTransfer.files?.[0];
    if (selectedFile) parseFile(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        title: "Example Book Title",
        author: "Author Name",
        genre: "Programming",
        description: "A brief description of the book",
        language: "en",
        tags: ["javascript", "web"],
        pdfUrl: "https://example.com/book.pdf",
        coverUrl: "https://example.com/cover.jpg",
        status: "draft"
      }
    ];

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elibrary-import-template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parsedBooks || parsedBooks.length === 0) return;

    try {
      const result = await bulkImport(parsedBooks).unwrap();
      setImportResult(result);
      if (result.failed > 0) {
        toast.error(`${result.imported} imported, ${result.failed} failed`);
      } else {
        toast.success(`${result.imported} books imported successfully`);
      }
    } catch (err) {
      const message = getApiErrorMessage(err, "Import failed");
      toast.error(message);
      setImportResult({
        imported: 0,
        failed: parsedBooks.length,
        errors: [{
          index: 0,
          title: "Import",
          reason: message
        }]
      });
    }
  };

  const resetState = () => {
    setParsedBooks(null);
    setParseError(null);
    setValidationErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (importResult) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="space-y-6 px-4 py-8 lg:py-10 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Import Results</h1>

          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
              ✓
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              {importResult.imported} books imported successfully
            </h2>

            {importResult.failed > 0 && (
              <p className="mb-6 font-medium text-red-600">
                {importResult.failed} items failed to import
              </p>
            )}

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 text-left">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                  Error Details
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 border-b border-gray-100 bg-white text-xs uppercase text-gray-500">
                      <tr>
                        <th className="w-16 px-4 py-2 font-medium">Row #</th>
                        <th className="px-4 py-2 font-medium">Title</th>
                        <th className="px-4 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {importResult.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500">
                            {err.index + 1}
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {err.title || "(untitled)"}
                          </td>
                          <td className="px-4 py-2 text-red-600">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={resetState}
                className="rounded-xl px-6 py-2 font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Import more
              </button>
              <button
                onClick={() => router.push("/admin/books")}
                className="rounded-xl bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Go to Books
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6 px-4 py-8 lg:py-10 max-w-4xl mx-auto">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Import Books</h1>
            <p className="mt-1 text-sm text-gray-500">Import books from a JSON file</p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Download JSON template
          </button>
        </div>

        {!parsedBooks ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group cursor-pointer rounded-2xl border-2 border-dashed p-16 transition-colors ${
                isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600 group-hover:scale-110 transition-transform">
                ⬆
              </div>
              <p className="text-lg font-medium text-gray-900">
                Drop a JSON file here or click to browse
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Must be an array of book objects with title, author, genre, and pdfUrl
              </p>
              <p className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg py-2 px-3">
                📌 PDF files should be under 50MB for optimal performance. Large PDFs may take longer to process.
              </p>
            </div>

            {parseError && (
              <div className="mt-6 inline-block rounded-xl bg-red-50 p-4 text-sm text-red-700">
                <span className="font-medium">Error reading file:</span> {parseError}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <h2 className="text-lg font-bold text-gray-900">
                Preview: {parsedBooks.length} items found
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={resetState}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isImporting ? "Importing..." : "Looks good, import now"}
                </button>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  {validationErrors.length} row{validationErrors.length === 1 ? "" : "s"} will be skipped.
                </p>
                <div className="mt-3 max-h-40 overflow-y-auto text-sm text-amber-800">
                  {validationErrors.map((error) => (
                    <div key={`${error.index}-${error.reason}`} className="py-1">
                      Row {error.index + 1}: {error.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Author</th>
                      <th className="px-4 py-3 font-medium">Genre</th>
                      <th className="px-4 py-3 font-medium">PDF URL</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedBooks.slice(0, 5).map((book, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {book.title || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {book.author || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {book.genre || "—"}
                        </td>
                        <td className="px-4 py-3 truncate text-gray-500 max-w-[200px]">
                          {book.pdfUrl || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                              book.status === "published"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {book.status || "draft"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedBooks.length > 5 && (
                <div className="border-t border-gray-100 bg-gray-50 py-3 text-center text-sm text-gray-500">
                  ...and {parsedBooks.length - 5} more items
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
