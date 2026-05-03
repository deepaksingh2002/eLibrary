"use client";

import React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as z from "zod";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "./ui/Button";
import { StarRating } from "./ui/StarRating";
import { toast } from "./ui/Toast";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please choose a rating").max(5, "Please choose a rating"),
  title: z.string().max(120, "Title must be 120 characters or fewer").optional().or(z.literal("")),
  body: z.string().max(2000, "Review must be 2000 characters or fewer").optional().or(z.literal("")),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  bookId: string;
  onSuccess: () => void;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ bookId, onSuccess }) => {
  const { isAuthenticated } = useAuthStore();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      title: "",
      body: "",
    },
  });

  const titleValue = watch("title") ?? "";
  const bodyValue = watch("body") ?? "";
  const ratingValue = watch("rating") ?? 0;

  const mutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      const payload = {
        bookId,
        rating: values.rating,
        title: values.title?.trim() || undefined,
        body: values.body?.trim() || undefined,
      };
      const response = await api.post("/api/reviews", payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Review submitted!");
      setServerError(null);
      reset({ rating: 0, title: "", body: "" });
      onSuccess();
    },
    onError: (error) => {
      const rawMessage = typeof error === "string" ? error : "Failed to submit review";
      const message =
        rawMessage.includes("already reviewed")
          ? "You have already reviewed this book"
          : rawMessage;

      setServerError(message);
      toast.error(message);
    },
  });

  const onSubmit = (values: ReviewFormValues) => {
    setServerError(null);
    return mutation.mutateAsync(values);
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-gray-700">Log in to write a review</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-gray-900">Write a Review</h3>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Your rating</p>
          <StarRating
            readOnly={false}
            size="lg"
            value={ratingValue}
            onChange={(rating) => {
              setValue("rating", rating, { shouldDirty: true, shouldValidate: true });
            }}
          />
          {errors.rating?.message && (
            <p className="mt-2 text-sm text-red-500">{errors.rating.message}</p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="review-title" className="text-sm font-medium text-gray-700">
              Title
            </label>
            <span className="text-xs text-gray-400">{titleValue.length} / 120</span>
          </div>
          <input
            id="review-title"
            type="text"
            maxLength={120}
            {...register("title")}
            className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Optional title"
          />
          {errors.title?.message && (
            <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="review-body" className="text-sm font-medium text-gray-700">
              Review
            </label>
            <span className="text-xs text-gray-400">{bodyValue.length} / 2000</span>
          </div>
          <textarea
            id="review-body"
            rows={5}
            maxLength={2000}
            {...register("body")}
            className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.body ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Share what you thought about this book"
          />
          {errors.body?.message && (
            <p className="mt-1 text-sm text-red-500">{errors.body.message}</p>
          )}
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting || mutation.isPending}
        >
          Submit Review
        </Button>
      </form>
    </div>
  );
};
