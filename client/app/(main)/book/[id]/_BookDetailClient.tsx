"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Book, PaginatedReviews, ReviewDistribution } from "../../../../types";
import { Spinner } from "../../../../components/ui/Spinner";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { StarRating } from "../../../../components/ui/StarRating";
import { ReviewForm } from "../../../../components/ReviewForm";
import { ReviewCard } from "../../../../components/ReviewCard";
import { RatingDistributionChart } from "../../../../components/RatingDistributionChart";
import { toast } from "../../../../components/ui/Toast";
import { useAuthStore } from "../../../../store/authStore";
import { ProgressSlider } from "../../../../components/ProgressSlider";
import { BookmarksPanel } from "../../../../components/BookmarksPanel";
import { SimilarBooksPanel } from "../../../../components/SimilarBooksPanel";
import { AIExplanationModal } from "../../../../components/AIExplanationModal";
import {
  useGetBookQuery,
  useGetBookReviewsQuery,
  useGetReviewDistributionQuery,
  useGetReadingProgressQuery,
  useGetMyReviewsQuery,
  useDownloadBookMutation,
} from "../../../../store/services/api";

interface MyReviewItem {
  _id: string;
  bookId: string | { _id: string; title: string; coverUrl?: string; author: string };
}

export default function BookDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { isAuthenticated, user } = useAuthStore();
  const [reviewsPage, setReviewsPage] = React.useState(1);
  const [reviewsSort, setReviewsSort] = React.useState("helpful");
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [showAIExplanation, setShowAIExplanation] = React.useState(false);
  const [downloadBook, downloadState] = useDownloadBookMutation();

  // Track hydration state
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: bookData, isLoading, isError, error } = useGetBookQuery(id, { skip: !id }) as {
    data?: { book: Book };
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
  const book = bookData?.book;

  const { data: reviewsData, isLoading: isReviewsLoading, isError: isReviewsError, refetch: refetchReviews } =
    useGetBookReviewsQuery({ bookId: id, page: reviewsPage, sort: reviewsSort }, { skip: !id }) as {
      data?: PaginatedReviews;
      isLoading: boolean;
      isError: boolean;
      refetch: () => void;
    };

  const { data: distributionData } = useGetReviewDistributionQuery(id, { skip: !id }) as {
    data?: ReviewDistribution;
  };

  const { data: progressData } = useGetReadingProgressQuery(id, {
    skip: !(isHydrated && !!id && !!user),
  }) as {
    data?: { progress: number } & Record<string, unknown>;
  };

  const { data: myReviews } = useGetMyReviewsQuery(undefined, { skip: !user }) as {
    data?: MyReviewItem[];
  };

  const hasReviewed = myReviews?.some((review) => {
    if (typeof review.bookId === "string") return review.bookId === id;
    return review.bookId?._id === id;
  });

  const myReview = myReviews?.find((review) => {
    if (typeof review.bookId === "string") return review.bookId === id;
    return review.bookId?._id === id;
  });

  const handleDownload = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    downloadBook(id)
      .unwrap()
      .then((data) => {
        if (!data.downloadUrl) {
          toast.error("Download URL is missing. Please try again.");
          return;
        }

        fetch(data.downloadUrl)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.blob();
          })
          .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = data.fileName || `book-${id}.pdf`;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("Download started!");
          })
          .catch(() => {
            const newWindow = window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
            if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
              toast.error("Download failed. Please try again.");
            } else {
              toast.success("Download started!");
            }
          });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Download failed. Please try again.";
        toast.error(message);
      });
  };

  const refreshReviewData = () => {
    refetchReviews();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Book not found</h2>
        <p className="text-gray-500">
          {error instanceof Error ? error.message : "The book you&apos;re looking for might have been removed."}
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="relative mb-6 aspect-[3/4] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-lg">
            {book.coverUrl ? (
              <Image
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="info">{book.genre}</Badge>
            <Badge>{book.language?.toUpperCase()}</Badge>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
            {book.title}
          </h1>
          <p className="mt-2 text-xl text-gray-500">by {book.author}</p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 font-medium text-yellow-500">
              <StarRating readOnly rating={book.avgRating} size="sm" />
              <span>{book.avgRating?.toFixed(1)}</span>
              <span className="font-normal text-gray-400 text-sm">
                ({book.totalReviews} reviews)
              </span>
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            <div className="flex items-center text-gray-400 text-sm">
              <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {book.downloads?.toLocaleString()} downloads
            </div>
          </div>

          <hr className="my-8 border-gray-200" />

          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Description</h3>
            <p className="max-w-3xl whitespace-pre-line leading-relaxed text-gray-700">
              {book.description || "No description provided for this book."}
            </p>
          </div>

          {book.tags && book.tags.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-gray-900">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  className="w-full px-8 font-semibold sm:w-auto"
                  onClick={handleDownload}
                  disabled={downloadState.isLoading}
                >
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloadState.isLoading ? "Preparing download..." : "Download PDF"}
                </Button>
                <Link href={`/book/${id}/read`}>
                  <Button size="lg" variant="secondary" className="w-full font-semibold sm:w-auto">
                    📖 {progressData?.progress ? `Continue Reading (${progressData.progress}%)` : "Read in Browser"}
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-semibold sm:w-auto"
                  onClick={() => setShowAIExplanation(true)}
                >
                  ✨ AI Summary
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" variant="ghost" className="w-full font-medium sm:w-auto" onClick={() => router.push("/login")}>
                  Log in to Download
                </Button>
                <Button size="lg" variant="ghost" className="w-full font-medium sm:w-auto opacity-60 cursor-not-allowed" disabled>
                  Log in to read
                </Button>
              </>
            )}
          </div>

          {user && (
            <div className="mt-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <ProgressSlider
                  bookId={id}
                  initialProgress={progressData?.progress || 0}
                />
              </div>
              <BookmarksPanel bookId={id} />
            </div>
          )}
        </div>
      </div>

      <section className="mt-16 border-t border-gray-200 pt-10">
        <h2 className="text-2xl font-bold text-gray-900">Reviews &amp; Ratings</h2>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <RatingDistributionChart
              distribution={distributionData ?? { distribution: [{ star: 1, count: 0 }, { star: 2, count: 0 }, { star: 3, count: 0 }, { star: 4, count: 0 }, { star: 5, count: 0 }], total: 0, average: 0 }}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="flex justify-end">
              <select
                value={reviewsSort}
                onChange={(event) => {
                  setReviewsSort(event.target.value);
                  setReviewsPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="helpful">Most Helpful</option>
                <option value="newest">Newest</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
              </select>
            </div>

            {isAuthenticated && !hasReviewed && (
              <ReviewForm bookId={id} onSuccess={refreshReviewData} />
            )}

            {isAuthenticated && hasReviewed && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                You&apos;ve already reviewed this book.
                {myReview && (
                  <Link href={`#review-${myReview._id}`} className="ml-2 font-medium underline">
                    Jump to your review
                  </Link>
                )}
              </div>
            )}

            {isReviewsLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">Loading reviews...</p>
              </div>
            ) : isReviewsError ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-600">Could not load reviews.</p>
                <Button className="mt-4" onClick={() => refetchReviews()}>Retry</Button>
              </div>
            ) : reviewsData?.reviews.length ? (
              <div className="space-y-4">
                {reviewsData.reviews.map((review) => (
                  <div id={`review-${review._id}`} key={review._id}>
                    <ReviewCard
                      review={review}
                      currentUserId={user?.id}
                      currentUserRole={user?.role}
                      onHelpfulToggle={refreshReviewData}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-gray-600">No reviews yet. Be the first to share your thoughts.</p>
              </div>
            )}

            {(reviewsData?.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reviewsPage === 1}
                  onClick={() => setReviewsPage((current) => current - 1)}
                >
                  Prev
                </Button>
                <span className="text-sm text-gray-500">
                  Page {reviewsPage} of {reviewsData?.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reviewsPage === reviewsData?.totalPages}
                  onClick={() => setReviewsPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SimilarBooksPanel bookId={id} />
      </section>

      {isAuthenticated && book && (
        <AIExplanationModal
          bookId={showAIExplanation ? id : null}
          bookTitle={book.title}
          mode="summary"
          readerReviews={reviewsData?.reviews ?? []}
          averageRating={book.avgRating}
          totalReviews={book.totalReviews}
          onClose={() => setShowAIExplanation(false)}
        />
      )}
    </div>
  );
}
