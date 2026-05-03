"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { Review } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { StarRating } from "./ui/StarRating";
import { toast } from "./ui/Toast";

interface ReviewCardProps {
  review: Review;
  currentUserId?: string;
  currentUserRole?: string;
  onHelpfulToggle: () => void;
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  currentUserId,
  currentUserRole,
  onHelpfulToggle,
}) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editRating, setEditRating] = React.useState(review.rating);
  const [editTitle, setEditTitle] = React.useState(review.title ?? "");
  const [editBody, setEditBody] = React.useState(review.body ?? "");

  React.useEffect(() => {
    setEditRating(review.rating);
    setEditTitle(review.title ?? "");
    setEditBody(review.body ?? "");
  }, [review]);

  const helpfulMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/reviews/${review._id}/helpful`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      onHelpfulToggle();
    },
    onError: (error) => {
      toast.error(typeof error === "string" ? error : "Failed to update helpful vote");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/api/reviews/${review._id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Review deleted");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviews-distribution"] });
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      onHelpfulToggle();
    },
    onError: (error) => {
      toast.error(typeof error === "string" ? error : "Failed to delete review");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const response = await api.patch(`/api/reviews/${review._id}`, {
        rating: editRating,
        title: editTitle.trim() || undefined,
        body: editBody.trim() || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Review updated");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviews-distribution"] });
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      onHelpfulToggle();
    },
    onError: (error) => {
      toast.error(typeof error === "string" ? error : "Failed to update review");
    },
  });

  const adminRemoveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.patch(`/api/reviews/${review._id}/flag`, { action: "remove" });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Review removed");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviews-distribution"] });
      queryClient.invalidateQueries({ queryKey: ["flagged-reviews"] });
      onHelpfulToggle();
    },
    onError: (error) => {
      toast.error(typeof error === "string" ? error : "Failed to remove review");
    },
  });

  const hasVoted = currentUserId ? review.voters.includes(currentUserId) : false;
  const isOwner = currentUserId === review.userId._id;
  const isAdmin = currentUserRole === "admin";

  if (isEditing) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Edit rating</p>
            <StarRating readOnly={false} value={editRating} onChange={setEditRating} size="md" />
          </div>
          <input
            type="text"
            value={editTitle}
            maxLength={120}
            onChange={(event) => setEditTitle(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Review title"
          />
          <textarea
            rows={4}
            value={editBody}
            maxLength={2000}
            onChange={(event) => setEditBody(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Review text"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => editMutation.mutate()}
              isLoading={editMutation.isPending}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
            {initialsFromName(review.userId.name)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{review.userId.name}</p>
            <p className="text-sm text-gray-500">{formatRelativeTime(review.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && review.isFlagged && <Badge variant="warning">Flagged</Badge>}
          <StarRating readOnly rating={review.rating} size="sm" />
        </div>
      </div>

      {review.title && <h4 className="mt-3 font-semibold text-gray-900">{review.title}</h4>}
      {review.body && <p className="mt-2 text-sm leading-relaxed text-gray-700">{review.body}</p>}

      <div className="mt-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => helpfulMutation.mutate()}
          disabled={!currentUserId || helpfulMutation.isPending}
          className={`text-sm font-medium transition-colors ${
            hasVoted ? "text-blue-600" : "text-gray-500 hover:text-blue-600"
          } ${!currentUserId ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Helpful? → ▲ {review.helpfulVotes}
        </button>

        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (window.confirm("Delete this review?")) {
                    deleteMutation.mutate();
                  }
                }}
                isLoading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </>
          )}
          {isAdmin && review.isFlagged && (
            <Button
              size="sm"
              variant="ghost"
              className="border-yellow-200 text-yellow-700 hover:bg-yellow-50"
              onClick={() => adminRemoveMutation.mutate()}
              isLoading={adminRemoveMutation.isPending}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
