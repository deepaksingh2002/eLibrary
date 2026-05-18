"use client";

import React, { useState } from "react";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { Button } from "../../../../components/ui/Button";
import { toast } from "../../../../components/ui/Toast";
import {
  useGetFlaggedReviewsQuery,
  useModerateReviewMutation,
} from "../../../../store/services/api";

interface FlaggedReview {
  _id: string;
  title?: string;
  body?: string;
  rating: number;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  bookId: {
    _id: string;
    title: string;
    author: string;
  };
  flagCount: number;
  flaggedAt: string;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useGetFlaggedReviewsQuery(page);

  const [moderateReview] = useModerateReviewMutation();

  const handleModerateReview = async (
    reviewId: string,
    action: "unflag" | "remove"
  ) => {
    setProcessingId(reviewId);
    try {
      await moderateReview({ reviewId, action }).unwrap();
      const message =
        action === "unflag"
          ? "Review unflagged successfully"
          : "Review removed successfully";
      toast.success(message);
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to moderate review";
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const reviews: FlaggedReview[] = data?.reviews || [];
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

  const truncate = (text?: string, length = 100) => {
    if (!text) return "No content";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6 px-4 py-8 lg:py-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Moderation</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data?.total || 0} flagged reviews awaiting moderation
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              <p className="text-sm text-gray-500">Loading reviews...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium mb-4">Failed to load reviews</p>
            <Button onClick={() => refetch()} className="bg-red-600 hover:bg-red-700">
              Retry
            </Button>
          </div>
        ) : reviews.length === 0 ? (
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900">No flagged reviews</p>
            <p className="mt-1 text-sm text-gray-500">All reviews are approved!</p>
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
                        Book
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Reviewer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Review
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Rating
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Flags
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reviews.map((review) => (
                      <tr
                        key={review._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {review.bookId.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {review.bookId.author}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {review.userId.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {review.userId.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {review.title || "Untitled"}
                            </p>
                            <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                              {truncate(review.body, 80)}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-sm font-medium text-yellow-500">
                              ★ {review.rating}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            {review.flagCount || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                handleModerateReview(review._id, "unflag")
                              }
                              disabled={processingId === review._id}
                              className="px-3 py-1.5 rounded-lg bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                            >
                              Unflag
                            </button>
                            <button
                              onClick={() =>
                                handleModerateReview(review._id, "remove")
                              }
                              disabled={processingId === review._id}
                              className="px-3 py-1.5 rounded-lg bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                              Remove
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
              {reviews.map((review) => (
                <div
                  key={review._id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {review.bookId.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {review.bookId.author}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                      {review.flagCount || 1}
                    </span>
                  </div>
                  <div className="mb-3 border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Reviewed by {review.userId.name}
                    </p>
                    <p className="text-xs text-gray-600 mb-2">
                      {review.userId.email}
                    </p>
                    <p className="font-medium text-sm text-gray-900 mb-1">
                      {review.title || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-3">
                      {truncate(review.body, 120)}
                    </p>
                    <div className="mt-2">
                      <span className="text-xs font-medium text-yellow-500">
                        ★ {review.rating}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() =>
                        handleModerateReview(review._id, "unflag")
                      }
                      disabled={processingId === review._id}
                      className="flex-1 px-3 py-2 rounded-lg bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      Unflag
                    </button>
                    <button
                      onClick={() =>
                        handleModerateReview(review._id, "remove")
                      }
                      disabled={processingId === review._id}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      Remove
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
      </div>
    </ProtectedRoute>
  );
}
