"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import api from "../../../../lib/api";
import { AdminBook } from "../../../../types";
import { Badge } from "../../../../components/ui/Badge";
import { Spinner } from "../../../../components/ui/Spinner";
import { toast } from "../../../../components/ui/Toast";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";

export default function AdminBooksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery<{ books: AdminBook[]; total: number; page: number; totalPages: number }>({
    queryKey: ["admin-books", page, search, statusFilter],
    queryFn: () =>
      api.get("/api/admin/books", {
        params: {
          page,
          limit: 20,
          ...(search && { search }),
          ...(statusFilter !== "all" && { status: statusFilter })
        }
      }).then((response) => response.data),
    staleTime: 1000 * 60 * 2
  });

  const toggleMutation = useMutation({
    mutationFn: (bookId: string) => api.patch(`/api/books/${bookId}/toggle-status`),
    onMutate: (bookId) => setTogglingId(bookId),
    onSettled: () => setTogglingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      toast.success("Book status updated");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to update book status");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (bookId: string) => api.delete(`/api/books/${bookId}`),
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      toast.success("Book deleted");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete book");
    }
  });

  return (
    <ProtectedRoute requiredRole="admin">
      <div>
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-gray-900">Book Management</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/books/import")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Import Books
            </button>
            <Link href="/admin/books/new">
              <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                <span>+</span> Add Book
              </button>
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <input
              type="text"
              placeholder="Search books..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex w-max gap-2 rounded-xl bg-gray-100 p-1">
            {(["all", "published", "draft"] as const).map((status) => (
              <button
                key={status}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === status ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
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

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="hidden grid-cols-[40px_1fr_120px_80px_80px_100px_200px] gap-4 border-b border-gray-100 bg-gray-50 p-4 text-xs font-medium uppercase tracking-wider text-gray-500 md:grid">
            <div>Cover</div>
            <div>Title & Author</div>
            <div>Genre</div>
            <div className="text-right">Downloads</div>
            <div className="text-right">Rating</div>
            <div className="text-center">Status</div>
            <div className="text-right">Actions</div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : data?.books.length === 0 ? (
            <div className="py-20 text-center text-gray-500">No books found</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data?.books.map((book) => (
                <div
                  key={book._id}
                  className="grid grid-cols-1 items-center gap-4 p-4 transition-colors hover:bg-gray-50 md:grid-cols-[40px_1fr_120px_80px_80px_100px_200px]"
                >
                  <div className="relative hidden h-[52px] w-10 overflow-hidden rounded-md bg-gray-100 md:block">
                    {book.coverUrl ? (
                      <Image src={book.coverUrl} alt={book.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] text-gray-400">
                        No Cover
                      </div>
                    )}
                  </div>

                  <div className="mb-2 flex gap-3 md:hidden">
                    <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {book.coverUrl ? (
                        <Image src={book.coverUrl} alt={book.title} fill className="object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <div className="line-clamp-1 text-sm font-medium text-gray-900">{book.title}</div>
                      <div className="line-clamp-1 text-xs text-gray-400">{book.author}</div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 md:block">
                    <div className="line-clamp-1 text-sm font-medium text-gray-900">{book.title}</div>
                    <div className="line-clamp-1 text-xs text-gray-400">{book.author}</div>
                  </div>

                  <div className="hidden md:block">
                    <Badge variant="default">{book.genre}</Badge>
                  </div>

                  <div className="flex justify-between text-sm text-gray-600 md:block md:text-right">
                    <span className="text-gray-400 md:hidden">Downloads:</span>
                    {book.downloads.toLocaleString()}
                  </div>

                  <div className="flex justify-between text-sm text-yellow-500 md:block md:text-right">
                    <span className="text-gray-400 md:hidden">Rating:</span>
                    {book.avgRating > 0 ? `★ ${book.avgRating.toFixed(1)}` : "—"}
                  </div>

                  <div className="flex items-center justify-between md:justify-center">
                    <span className="text-sm text-gray-400 md:hidden">Status:</span>
                    <button
                      onClick={() => toggleMutation.mutate(book._id)}
                      disabled={togglingId === book._id}
                      className={`flex w-[85px] items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${
                        book.status === "published"
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {togglingId === book._id ? <Spinner size="sm" /> : book.status === "published" ? "Published" : "Draft"}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap justify-end gap-2 md:mt-0">
                    <Link href={`/admin/books/${book._id}/edit`}>
                      <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600">
                        Edit
                      </button>
                    </Link>
                    <button
                      onClick={() => setConfirmDeleteId(confirmDeleteId === book._id ? null : book._id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => router.push(`/book/${book._id}`)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                    >
                      View
                    </button>
                    {confirmDeleteId === book._id && (
                      <>
                        <button
                          onClick={() => deleteMutation.mutate(book._id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {data && data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between px-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)} of {data.total} books
            </span>
            <button
              disabled={page === data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
