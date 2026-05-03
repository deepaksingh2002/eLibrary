"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../../../lib/api";
import { useAuthStore } from "../../../../../../store/authStore";
import { Book } from "../../../../../../types";
import UploadProgress from "../../../../../../components/admin/UploadProgress";
import BookFormFields from "../../../../../../components/admin/BookFormFields";
import { ProtectedRoute } from "../../../../../../components/ProtectedRoute";
import { Spinner } from "../../../../../../components/ui/Spinner";
import { useBookForm } from "../../../../../../hooks/useBookForm";

function EditBookContent() {
  const params = useParams();
  const { isAuthenticated, user } = useAuthStore();
  const bookId = typeof params.id === "string" ? params.id : "";

  const {
    data: bookResponse,
    isLoading,
    isError
  } = useQuery<{ book: Book }>({
    queryKey: ["book", bookId],
    queryFn: () => api.get(`/api/books/${bookId}`).then((response) => response.data),
    enabled: Boolean(bookId) && isAuthenticated && user?.role === "admin",
    staleTime: 1000 * 60
  });

  const book = bookResponse?.book;
  const initialData = useMemo(() => {
    if (!book) return undefined;

    return {
      title: book.title || "",
      author: book.author || "",
      description: book.description || "",
      genre: book.genre || "",
      language: book.language || "en",
      tags: Array.isArray(book.tags) ? book.tags.join(", ") : "",
      status: book.status || "draft",
      coverFile: null,
      pdfFile: null
    };
  }, [book]);

  const {
    values,
    errors,
    uploadProgress,
    isSubmitting,
    setField,
    handleSubmit
  } = useBookForm({
    bookId,
    initialData
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-gray-500">Loading book...</p>
        </div>
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium text-gray-700">Book not found</p>
          <p className="mb-4 text-sm text-gray-500">
            The book you are trying to edit does not exist.
          </p>
          <Link href="/admin/books" className="text-sm text-blue-600 hover:underline">
            Back to books
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UploadProgress
          visible={isSubmitting}
          progress={uploadProgress}
          label="Saving changes..."
        />

        <div className="mb-8">
          <Link
            href="/admin/books"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            Back to Books
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Book</h1>
          <p className="mt-1 line-clamp-1 text-sm text-gray-500">{book.title}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Downloads", value: book.downloads || 0 },
            { label: "Rating", value: book.avgRating ? `★ ${book.avgRating}` : "—" },
            { label: "Reviews", value: book.totalReviews || 0 },
            {
              label: "Added",
              value: new Date(book.createdAt).toLocaleDateString("en", {
                month: "short",
                year: "numeric"
              })
            }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-100 bg-white p-3 text-center"
            >
              <p className="text-lg font-bold text-gray-800">{value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8">
          <BookFormFields
            values={values}
            errors={errors}
            isEditMode={true}
            previewCoverUrl={book.coverUrl}
            onChange={setField}
          />

          {book.pdfUrl && !values.pdfFile && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="text-2xl font-semibold text-green-700">PDF</span>
              <div>
                <p className="text-sm font-medium text-green-700">Current PDF is saved</p>
                <p className="text-xs text-green-600">
                  Upload a new file above to replace it
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? `Saving ${uploadProgress}%...` : "Save Changes"}
            </button>
            <Link
              href="/admin/books"
              className="rounded-xl border border-gray-200 px-8 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditBookPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <EditBookContent />
    </ProtectedRoute>
  );
}
