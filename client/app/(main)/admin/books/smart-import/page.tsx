"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ProtectedRoute } from "../../../../../components/ProtectedRoute";
import { useSmartImport } from "../../../../../hooks/useSmartImport";
import SmartImportCard from "../../../../../components/admin/SmartImportCard";

const SMART_IMPORT_SUGGESTIONS = [
  "Introduction to Algorithms",
  "Clean Code Robert Martin",
  "The Pragmatic Programmer",
  "Designing Data-Intensive Applications",
  "Python Crash Course",
  "Atomic Habits James Clear",
  "The Great Gatsby",
  "A Brief History of Time"
];

const SMART_IMPORT_STEPS = [
  { step: "1", icon: "🔍", text: "Search any book title or author" },
  { step: "2", icon: "🌐", text: "Fetches data from Google Books + Open Library" },
  { step: "3", icon: "✨", text: "Gemini AI enhances genre, tags and description" },
  { step: "4", icon: "➕", text: "Click Add to Library — done!" }
];

function SmartImportContent() {
  const [isFocused, setIsFocused] = useState(false);
  const {
    query,
    setQuery,
    results,
    loading,
    searched,
    addingId,
    search,
    addBook
  } = useSmartImport();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      search(query);
    }
  };

  const alreadyImportedCount = results.filter((result) => result.alreadyExists).length;
  const freePdfCount = results.filter((result) => result.pdfUrl).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <Link href="/admin/books" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700">
            ← Back to Books
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                🔍 Smart Book Import
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Search the internet for any book and add it to your library with one click. Metadata is automatically enhanced by Gemini AI.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-800">How it works</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {SMART_IMPORT_STEPS.map(({ step, icon, text }) => (
              <div key={step} className="flex items-start gap-2">
                <span className="flex-shrink-0 text-lg">{icon}</span>
                <p className="text-xs text-blue-700">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-blue-600">
            📌 Books with a green &quot;Free PDF&quot; badge include a direct PDF link from Internet Archive (public domain books). For others, you can upload the PDF after adding.
          </p>
        </div>

        <div className={`mb-6 rounded-2xl border bg-white p-6 transition-shadow ${isFocused ? "border-blue-200 shadow-sm" : "border-gray-200"}`}>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder='Search by title, author, or ISBN e.g. "Clean Code"'
                className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              onClick={() => search(query)}
              disabled={loading || query.trim().length < 2}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </button>
          </div>

          {!searched ? (
            <div className="mt-4">
              <p className="mb-2 text-xs text-gray-400">Try searching for:</p>
              <div className="flex flex-wrap gap-2">
                {SMART_IMPORT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      search(suggestion);
                    }}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
                <div className="h-24 w-16 flex-shrink-0 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-7 w-28 rounded-xl bg-gray-200" />
                    <div className="h-7 w-16 rounded-xl bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && searched && results.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 text-5xl">📭</div>
            <p className="mb-2 text-lg font-medium text-gray-700">No books found</p>
            <p className="text-sm text-gray-500">Try different keywords or check the spelling</p>
          </div>
        ) : null}

        {!loading && results.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{results.length} results found</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {alreadyImportedCount} already in your library · {freePdfCount} with free PDF
                </p>
              </div>
              <div className="text-xs text-gray-400">Sources: Google Books + Open Library</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {results.map((book) => (
                <SmartImportCard
                  key={`${book.source}-${book.externalId}`}
                  book={book}
                  onAdd={addBook}
                  isAdding={addingId === book.externalId}
                />
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong>After adding a book:</strong> Books without a PDF are saved as Draft. Go to <Link href="/admin/books" className="font-medium underline">Admin → Books</Link> → click Edit to upload the PDF and publish the book.
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function SmartImportPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <SmartImportContent />
    </ProtectedRoute>
  );
}