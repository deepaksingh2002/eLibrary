"use client";

import Link from "next/link";
import UploadProgress from "../../../../../components/admin/UploadProgress";
import BookFormFields from "../../../../../components/admin/BookFormFields";
import { ProtectedRoute } from "../../../../../components/ProtectedRoute";
import { useBookForm } from "../../../../../hooks/useBookForm";

function AddBookContent() {
  const {
    values,
    errors,
    uploadProgress,
    isSubmitting,
    setField,
    handleSubmit
  } = useBookForm();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UploadProgress
          visible={isSubmitting}
          progress={uploadProgress}
          label="Uploading book..."
        />

        <div className="mb-8">
          <Link
            href="/admin/books"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            Back to Books
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Add New Book</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a new book to the eLibrary collection
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8">
          <BookFormFields
            values={values}
            errors={errors}
            isEditMode={false}
            onChange={setField}
          />

          <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? `Uploading ${uploadProgress}%...` : "Add Book to Library"}
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

export default function AddBookPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AddBookContent />
    </ProtectedRoute>
  );
}
