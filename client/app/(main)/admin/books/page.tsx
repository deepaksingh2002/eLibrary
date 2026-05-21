"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { toast } from "../../../../components/ui/Toast";
import {
  useGetAdminBooksQuery,
  useToggleBookStatusMutation,
  useDeleteBookMutation,
} from "../../../../store/services/api";

interface AdminBook {
  _id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  coverUrl?: string;
  pdfUrl: string;
  status: "published" | "draft";
  downloads: number;
  avgRating: number;
  totalReviews: number;
  extractionStatus?: "pending" | "uploading" | "ready" | "failed" | "no_pdf";
  createdAt: string;
  updatedAt: string;
}

function getAiStatusLabel(status?: AdminBook["extractionStatus"]) {
  switch (status) {
    case "ready":
      return <span className="text-green-600">✅ AI Ready</span>;
    case "uploading":
      return <span className="text-blue-600">⏳ Uploading</span>;
    case "failed":
      return <span className="text-red-500">❌ Failed</span>;
    case "no_pdf":
      return <span className="text-gray-400">🚫 No PDF</span>;
    default:
      return <span className="text-amber-500">⏳ Pending</span>;
  }
}

export default function AdminBooksPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error, refetch } = useGetAdminBooksQuery({
    page,
    search: debouncedSearch,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const [toggleStatus] = useToggleBookStatusMutation();
  const [deleteBook, { isLoading: isDeletingBook }] =
    useDeleteBookMutation();

  const handleToggleStatus = async (bookId: string) => {
    setTogglingId(bookId);
    try {
      await toggleStatus(bookId).unwrap();
      toast.success("Book status updated");
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      toast.error(message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      await deleteBook(bookId).unwrap();
      toast.success("Book deleted");
      setConfirmDeleteId(null);
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete book";
      toast.error(message);
    }
  };

  const books: AdminBook[] = data?.books || [];
  const totalPages = data?.totalPages || 1;

  const buildPageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 1) return [1];
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      if (i > 1 && i < totalPages) pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6 px-4 py-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Book Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data?.total || 0} total books
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/admin/books/import")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Import Books
            </button>
            <Link href="/admin/books/new">
              <button className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2">
                <span>+</span> Add Book
              </button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by title or author..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex w-max gap-2 rounded-xl bg-gray-100 p-1">
            {(["all", "published", "draft"] as const).map((status) => (
              <button
                key={status}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              <p className="text-sm text-gray-500">Loading books...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium mb-4">Failed to load books</p>
            <Button onClick={() => refetch()} className="bg-red-600 hover:bg-red-700">
              Retry
            </Button>
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747S17.5 6.253 12 6.253z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900">No books found</p>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Cover
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Title & Author
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Genre
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Downloads
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Rating
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        AI Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {books.map((book) => (
                      <tr key={book._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="relative h-14 w-10 overflow-hidden rounded-lg bg-gray-100">
                            {book.coverUrl ? (
                              <Image
                                src={book.coverUrl}
                                alt={book.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                                No Cover
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {book.title}
                            </p>
                            <p className="text-xs text-gray-500">{book.author}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="default">{book.genre}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {book.downloads.toLocaleString()}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-medium text-yellow-500">
                            {book.avgRating > 0 ? `★ ${book.avgRating.toFixed(1)}` : "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(book._id)}
                            disabled={togglingId === book._id}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              book.status === "published"
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            } disabled:opacity-50 flex items-center justify-center min-w-[100px]`}
                          >
                            {togglingId === book._id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              book.status === "published" ? "Published" : "Draft"
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs font-medium">
                            {getAiStatusLabel(book.extractionStatus)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/books/${book._id}/edit`}>
                              <button className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">
                                Edit
                              </button>
                            </Link>
                            <Link href={`/book/${book._id}`}>
                              <button className="text-xs font-medium text-gray-600 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                                View
                              </button>
                            </Link>
                            <button
                              onClick={() => setConfirmDeleteId(confirmDeleteId === book._id ? null : book._id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 md:hidden">
              {books.map((book) => (
                <div
                  key={book._id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex gap-4 mb-4">
                    <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {book.coverUrl ? (
                        <Image
                          src={book.coverUrl}
                          alt={book.title}
                          fill
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {book.title}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">{book.author}</p>
                      <Badge variant="default">{book.genre}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Downloads</span>
                      <span className="font-medium text-gray-900">
                        {book.downloads.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rating</span>
                      <span className="font-medium text-yellow-500">
                        {book.avgRating > 0 ? `★ ${book.avgRating.toFixed(1)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <button
                        onClick={() => handleToggleStatus(book._id)}
                        disabled={togglingId === book._id}
                        className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                          book.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        } disabled:opacity-50`}
                      >
                        {book.status === "published" ? "Published" : "Draft"}
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">AI Status</span>
                      <span className="text-xs font-medium">
                        {getAiStatusLabel(book.extractionStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Link href={`/admin/books/${book._id}/edit`} className="flex-1">
                      <button className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-2 rounded hover:bg-blue-50">
                        Edit
                      </button>
                    </Link>
                    <Link href={`/book/${book._id}`} className="flex-1">
                      <button className="w-full text-xs font-medium text-gray-600 hover:text-gray-700 py-2 rounded hover:bg-gray-50">
                        View
                      </button>
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(confirmDeleteId === book._id ? null : book._id)}
                      className="flex-1 text-xs font-medium text-red-600 hover:text-red-700 py-2 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {pageNumbers.map((num, idx) => (
                  <React.Fragment key={num}>
                    {idx > 0 && pageNumbers[idx - 1] !== num - 1 && (
                      <span className="text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setPage(num)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        page === num
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {num}
                    </button>
                  </React.Fragment>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-2xl bg-white p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Delete Book
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this book? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDeleteId && handleDeleteBook(confirmDeleteId)}
                  disabled={isDeletingBook}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingBook ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
