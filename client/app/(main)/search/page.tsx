"use client";

import React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "../../../lib/api";
import { buildPageNumbers } from "../../../lib/utils";
import type { AutocompleteSuggestion, SearchResult } from "../../../types";
import { BookCard } from "../../../components/BookCard";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";

const genreOptions = [
  "All Genres",
  "Programming",
  "Mathematics",
  "Science",
  "Literature",
  "History",
  "Business",
  "Philosophy",
  "Engineering",
  "Other",
];

const languageOptions = [
  "All Languages",
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
];

const sortOptions = [
  { value: "relevance", label: "Most Relevant" },
  { value: "downloads", label: "Most Downloaded" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

const languageMap: Record<string, string> = {
  English: "en",
  Hindi: "hi",
  Spanish: "es",
  French: "fr",
  German: "de",
};

const reverseLanguageMap = Object.fromEntries(
  Object.entries(languageMap).map(([label, value]) => [value, label])
);

function BookCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-3 h-5 w-20 rounded-full" />
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  const q = searchParams.get("q") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const language = searchParams.get("language") ?? "";
  const rawSort = searchParams.get("sort") ?? (q ? "relevance" : "newest");
  const sort = !q && rawSort === "relevance" ? "newest" : rawSort;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [inputValue, setInputValue] = React.useState(q);
  const [debouncedValue, setDebouncedValue] = React.useState(q);
  const [showDropdown, setShowDropdown] = React.useState(false);

  React.useEffect(() => {
    setInputValue(q);
  }, [q]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(inputValue.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [inputValue]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const updateUrl = React.useCallback(
    (updates: Record<string, string | null>, resetPage = false) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) params.delete(key);
        else params.set(key, value);
      });

      if (resetPage) {
        params.set("page", "1");
      }

      const next = params.toString();
      router.push(next ? `/search?${next}` : "/search");
    },
    [router, searchParams]
  );

  const searchQuery = useQuery<SearchResult>({
    queryKey: ["search", q, genre, language, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (genre) params.set("genre", genre);
      if (language) params.set("language", language);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      params.set("limit", "12");

      const response = await api.get(`/api/books/search?${params.toString()}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const autocompleteQuery = useQuery<{ suggestions: AutocompleteSuggestion[] }>({
    queryKey: ["autocomplete", debouncedValue],
    queryFn: async () => {
      const response = await api.get(`/api/books/autocomplete?q=${encodeURIComponent(debouncedValue)}`);
      return response.data;
    },
    enabled: debouncedValue.length >= 2,
  });

  const activeFilters = [
    genre ? { key: "genre", label: genre } : null,
    language ? { key: "language", label: reverseLanguageMap[language] ?? language } : null,
    sort && sort !== (q ? "relevance" : "newest")
      ? { key: "sort", label: sortOptions.find((option) => option.value === sort)?.label ?? sort }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const pageNumbers = buildPageNumbers(page, searchQuery.data?.totalPages ?? 1);
  const suggestions = autocompleteQuery.data?.suggestions ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:py-10">
      <div className="rounded-3xl bg-gradient-to-r from-blue-50 via-white to-sky-50 p-6 shadow-sm ring-1 ring-blue-100">
        <h1 className="text-3xl font-bold text-gray-900">Search the library</h1>
        <p className="mt-2 text-sm text-gray-500">
          Find books by title, author, topic, language, or popularity.
        </p>

        <div className="relative mt-6" ref={dropdownRef}>
          <input
            type="search"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                updateUrl({ q: inputValue.trim() || null }, true);
                setShowDropdown(false);
              }

              if (event.key === "Escape") {
                setShowDropdown(false);
              }
            }}
            placeholder="Search by title, author, or keyword"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-base shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />

          {showDropdown && inputValue.trim().length >= 2 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              {autocompleteQuery.isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="h-6 w-6 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="py-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion._id}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50"
                      onClick={() => {
                        setInputValue(suggestion.title);
                        updateUrl({ q: suggestion.title }, true);
                        setShowDropdown(false);
                      }}
                    >
                      <div className="relative h-6 w-6 overflow-hidden rounded bg-gray-100">
                        {suggestion.coverUrl ? (
                          <Image src={suggestion.coverUrl} alt={suggestion.title} fill className="object-cover" sizes="40px" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{suggestion.title}</p>
                        <p className="text-xs text-gray-500">{suggestion.author}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-gray-500">No suggestions found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label htmlFor="genre-filter" className="mb-2 block text-sm font-medium text-gray-700">
              Genre
            </label>
            <select
              id="genre-filter"
              value={genre || "All Genres"}
              onChange={(event) =>
                updateUrl({ genre: event.target.value === "All Genres" ? null : event.target.value }, true)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {genreOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="language-filter" className="mb-2 block text-sm font-medium text-gray-700">
              Language
            </label>
            <select
              id="language-filter"
              value={language ? reverseLanguageMap[language] ?? language : "All Languages"}
              onChange={(event) =>
                updateUrl(
                  {
                    language:
                      event.target.value === "All Languages"
                        ? null
                        : languageMap[event.target.value] ?? event.target.value.toLowerCase(),
                  },
                  true
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sort-filter" className="mb-2 block text-sm font-medium text-gray-700">
              Sort
            </label>
            <select
              id="sort-filter"
              value={sort}
              onChange={(event) => updateUrl({ sort: event.target.value }, true)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions
                .filter((option) => (option.value === "relevance" ? Boolean(q) : true))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>

          {activeFilters.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter.key} variant="info">
                    <span className="inline-flex items-center gap-2">
                      {filter.label}
                      <button type="button" onClick={() => updateUrl({ [filter.key]: null }, true)}>
                        ×
                      </button>
                    </span>
                  </Badge>
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            </div>
          )}
        </aside>

        <section>
          {searchQuery.isLoading ? (
            <>
              <div className="mb-6">
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }, (_, index) => (
                  <BookCardSkeleton key={index} />
                ))}
              </div>
            </>
          ) : searchQuery.isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-600">Failed to load search results.</p>
              <Button className="mt-4" onClick={() => searchQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-gray-500">
                {q
                  ? `Results for "${q}" — ${searchQuery.data?.total ?? 0} books found`
                  : `${searchQuery.data?.total ?? 0} books`}
              </p>

              {searchQuery.data && searchQuery.data.total === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                  {q ? (
                    <>
                      <h2 className="text-xl font-semibold text-gray-900">No books found for &quot;{q}&quot;</h2>
                      <p className="mt-2 text-sm text-gray-500">Try different keywords or clear the filters</p>
                      <Button className="mt-5" onClick={() => router.push("/search")}>
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-gray-900">No books match these filters</h2>
                      <Button className="mt-5" onClick={() => router.push("/search")}>
                        Clear filters
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                    {searchQuery.data?.books.map((book) => (
                      <BookCard key={book._id} book={book} />
                    ))}
                  </div>

                  {(searchQuery.data?.totalPages ?? 0) > 1 && (
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => {
                          updateUrl({ page: String(page - 1) });
                          window.scrollTo(0, 0);
                        }}
                      >
                        Prev
                      </Button>

                      {pageNumbers.map((pageNumber, index) => {
                        const previous = pageNumbers[index - 1];
                        const showGap = previous && pageNumber - previous > 1;

                        return (
                          <React.Fragment key={pageNumber}>
                            {showGap && <span className="px-1 text-sm text-gray-400">...</span>}
                            <button
                              type="button"
                              onClick={() => {
                                updateUrl({ page: String(pageNumber) });
                                window.scrollTo(0, 0);
                              }}
                              className={`min-w-9 rounded-lg px-3 py-2 text-sm font-medium ${
                                pageNumber === page
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          </React.Fragment>
                        );
                      })}

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={page >= (searchQuery.data?.totalPages ?? 1)}
                        onClick={() => {
                          updateUrl({ page: String(page + 1) });
                          window.scrollTo(0, 0);
                        }}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-sm text-gray-500">Loading search...</div>}>
      <SearchPageContent />
    </React.Suspense>
  );
}
