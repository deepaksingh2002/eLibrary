"use client";

import Image from "next/image";
import type { SearchedBook } from "../../hooks/useSmartImport";

interface Props {
  book: SearchedBook;
  onAdd: (book: SearchedBook) => void;
  isAdding: boolean;
}

const SOURCE_LABELS: Record<SearchedBook["source"], string> = {
  google_books: "Google Books",
  open_library: "Open Library",
};

export default function SmartImportCard({ book, onAdd, isAdding }: Props) {
  const sourceLabel = SOURCE_LABELS[book.source] ?? book.source;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
        book.alreadyExists
          ? "border-green-200 opacity-75"
          : "border-gray-100 hover:border-blue-200 hover:shadow-md"
      }`}
    >
      <div className="flex gap-4 p-4">
        <div className="flex-shrink-0">
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={book.title}
              width={64}
              height={96}
              className="h-24 w-16 rounded-lg object-cover"
              onError={(event) => {
                event.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='96' viewBox='0 0 64 96'%3E%3Crect width='64' height='96' fill='%23E5E7EB'/%3E%3Ctext x='32' y='52' text-anchor='middle' fill='%239CA3AF' font-size='24'%3E%F0%9F%93%9A%3C/text%3E%3C/svg%3E";
              }}
            />
          ) : (
            <div className="flex h-24 w-16 items-center justify-center rounded-lg bg-gray-100 text-2xl">
              📚
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-900 line-clamp-2">
              {book.title}
            </h3>
          </div>

          <p className="mb-2 text-xs text-gray-500">by {book.author}</p>

          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {book.genre}
            </span>

            {book.pdfUrl ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                ✓ Free PDF
              </span>
            ) : null}

            {book.aiEnhanced ? (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                ✨ AI Enhanced
              </span>
            ) : null}

            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {sourceLabel}
            </span>

            {book.publishedYear ? <span className="text-xs text-gray-400">{book.publishedYear}</span> : null}
          </div>

          {book.description ? (
            <p className="mb-3 line-clamp-2 text-xs text-gray-600">{book.description}</p>
          ) : null}

          {book.tags.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-1">
              {book.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {book.alreadyExists ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                ✓ Already in library
              </span>
            ) : (
              <button
                onClick={() => onAdd(book)}
                disabled={isAdding}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdding ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    Adding...
                  </>
                ) : (
                  <>+ Add to Library</>
                )}
              </button>
            )}

            {book.previewUrl ? (
              <a
                href={book.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-2 text-xs text-blue-600 hover:underline"
              >
                Preview ↗
              </a>
            ) : null}

            {!book.pdfUrl && !book.alreadyExists ? (
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-600">
                Upload PDF after adding
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}