"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../lib/api";
import { buildPageNumbers, getApiErrorMessage } from "../../../../lib/utils";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { Button } from "../../../../components/ui/Button";
import { StarRating } from "../../../../components/ui/StarRating";
import { toast } from "../../../../components/ui/Toast";

interface FlaggedReviewRow {
  _id: string;
  title?: string;
  body?: string;
  rating: number;
  userId: {
    name: string;
    email: string;
  };
  bookId: {
    title: string;
    author: string;
  };
}

interface FlaggedReviewResponse {
  reviews: FlaggedReviewRow[];
  total: number;
  page: number;
  totalPages: number;
}

const truncate = (value?: string, max = 100) => {
  if (!value) return "No body provided";
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError, refetch } = useQuery<FlaggedReviewResponse>({
    queryKey: ["flagged-reviews", page],
    queryFn: async () => {
      const response = await api.get(`/api/reviews/flagged?page=${page}&limit=20`);
      return response.data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ reviewId, action }: { reviewId: string; action: "unflag" | "remove" }) => {
      const response = await api.patch(`/api/reviews/${reviewId}/flag`, { action });
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "remove" ? "Review removed" : "Review unflagged");
      queryClient.invalidateQueries({ queryKey: ["flagged-reviews"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const pageNumbers = buildPageNumbers(page, data?.totalPages ?? 1);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:py-10">
        <h1 className="text-3xl font-bold text-gray-900">Review Moderation</h1>
        <p className="mt-2 text-sm text-gray-500">Flagged reviews awaiting action</p>

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-500">Loading flagged reviews...</p>
          </div>
        ) : isError ? (
          <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600">Could not load flagged reviews.</p>
            <Button className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : data?.reviews.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-gray-900">No flagged reviews — all clear ✓</p>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-4">
              {data?.reviews.map((review) => (
                <div key={review._id} className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_1fr_1.5fr_0.8fr_1fr]">
                  <div>
                    <p className="font-semibold text-gray-900">{review.bookId.title}</p>
                    <p className="text-sm text-gray-500">{review.bookId.author}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{review.userId.name}</p>
                    <p className="text-sm text-gray-500">{review.userId.email}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{review.title || "Untitled review"}</p>
                    <p className="mt-1 text-sm text-gray-600">{truncate(review.body)}</p>
                  </div>
                  <div>
                    <StarRating readOnly rating={review.rating} size="sm" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => actionMutation.mutate({ reviewId: review._id, action: "unflag" })}
                      isLoading={actionMutation.isPending}
                    >
                      Unflag
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => actionMutation.mutate({ reviewId: review._id, action: "remove" })}
                      isLoading={actionMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {(data?.totalPages ?? 1) > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
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
                        onClick={() => setPage(pageNumber)}
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
                  size="sm"
                  variant="ghost"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
