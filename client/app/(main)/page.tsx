"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaginatedBooks, ReadingProgress, Book } from "../../types";
import { BookCard } from "../../components/BookCard";
import { Spinner } from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/authStore";
import { RecommendationsShelf } from "../../components/RecommendationsShelf";
import Image from "next/image";
import { useGetBooksQuery, useGetDashboardQuery } from "../../store/services/api";

const ContinueReadingCard = ({ progressItem }: { progressItem: ReadingProgress & { bookId: Book } }) => {
  const { bookId: book, progress } = progressItem;
  return (
    <Link href={`/book/${book._id}`} className="block w-36 flex-shrink-0 group">
      <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-gray-100 mb-2 border border-gray-200 group-hover:border-blue-400 transition-colors">
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt={book.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Cover</div>
        )}
      </div>
      <h3 className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight">
        {book.title}
      </h3>
      <div className="mt-1.5">
        <div className="h-1 bg-gray-200 rounded w-full overflow-hidden">
          <div className="bg-blue-500 h-full rounded" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{Math.round(progress)}% complete</p>
      </div>
    </Link>
  );
};

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, error } = useGetBooksQuery({ page: 1, limit: 12, status: "published" }) as {
    data?: PaginatedBooks;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };

  const { user } = useAuthStore();

  const { data: dashData } = useGetDashboardQuery(undefined, { skip: !user });
  const continueReading: Array<ReadingProgress & { bookId: Book }> = dashData?.continueReading ?? [];

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  return (
    <div>
      <section className="relative w-full overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-sky-800 py-20 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-24 top-8 h-64 w-64 rounded-full bg-sky-400 blur-3xl" />
          <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-indigo-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">Your Digital Library</h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-blue-100/90">
            Discover, read, and track your academic journey
          </p>

          <form onSubmit={handleSearch} className="mx-auto mb-10 flex max-w-2xl overflow-hidden rounded-2xl bg-white p-1 shadow-2xl shadow-blue-950/20 ring-1 ring-white/10" role="search">
            <label htmlFor="hero-search" className="sr-only">Search books</label>
            <input
              id="hero-search"
              type="search"
              placeholder="Search by title, author, or keywords..."
              aria-label="Search books"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch(event);
                }
              }}
              className="flex-grow rounded-xl border-0 bg-white px-4 py-4 text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="rounded-xl bg-blue-600 px-6 py-4 font-semibold transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-blue-100/90 md:gap-8 md:text-base">
            <div><span className="font-bold text-white">12,400+</span> Books</div>
            <div className="hidden h-6 w-px bg-white/20 md:block"></div>
            <div><span className="font-bold text-white">3,800</span> Users</div>
            <div className="hidden h-6 w-px bg-white/20 md:block"></div>
            <div><span className="font-bold text-white">98,500</span> Downloads</div>
          </div>
        </div>
      </section>

      {user && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <RecommendationsShelf title="Recommended for You" showRefresh={false} />
        </section>
      )}

      {user && continueReading.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-8">
          <h2 className="font-bold text-xl text-gray-900 mb-4">Continue Reading</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {continueReading.map((prog) => (
              <ContinueReadingCard key={prog._id} progressItem={prog} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Browse Books</h2>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : isError ? (
          <div className="py-20 text-center text-red-500">
            <p>Failed to load books: {error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : !data?.books || data.books.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No books found</h3>
            <p className="mt-1 text-gray-500">Check back later for new additions.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.books.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
            <div className="mt-8">
              <Link href="/search" className="font-medium text-blue-600 hover:text-blue-700">
                View all books →
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
