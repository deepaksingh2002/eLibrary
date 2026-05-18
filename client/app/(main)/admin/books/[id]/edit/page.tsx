"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ProtectedRoute } from "../../../../../../components/ProtectedRoute";
import { Button } from "../../../../../../components/ui/Button";
import { Input } from "../../../../../../components/ui/Input";
import { toast } from "../../../../../../components/ui/Toast";
import {
  useGetBookQuery,
  useUpdateBookMutation,
} from "../../../../../../store/services/api";

interface Book {
  _id: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string[];
  status: "published" | "draft";
  coverUrl?: string;
  pdfUrl: string;
  createdAt: string;
  updatedAt?: string;
}

interface FormData {
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string;
  status: "published" | "draft";
  coverFile?: File | null;
  pdfFile?: File | null;
}

export default function EditBookPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = typeof params.id === "string" ? params.id : "";

  const { data: bookData, isLoading, error } = useGetBookQuery(bookId);
  const [updateBook, { isLoading: isUpdatingBook }] = useUpdateBookMutation();

  const [formData, setFormData] = useState<FormData>({
    title: "",
    author: "",
    description: "",
    genre: "",
    language: "en",
    tags: "",
    status: "draft",
    coverFile: null,
    pdfFile: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadProgress] = useState(0);
  const book: Book | null = bookData?.book ?? null;

  // Initialize form with book data
  React.useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || "",
        author: book.author || "",
        description: book.description || "",
        genre: book.genre || "",
        language: book.language || "en",
        tags: Array.isArray(book.tags) ? book.tags.join(", ") : "",
        status: book.status || "draft",
        coverFile: null,
        pdfFile: null,
      });
      setErrors({});
    }
  }, [book]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files.length > 0) {
      setFormData((prev) => ({
        ...prev,
        [name]: files[0],
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!formData.author.trim()) {
      newErrors.author = "Author is required";
    }
    if (!formData.genre.trim()) {
      newErrors.genre = "Genre is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Prepare FormData for multipart upload
      const formDataObj = new FormData();
      formDataObj.append("title", formData.title);
      formDataObj.append("author", formData.author);
      formDataObj.append("description", formData.description);
      formDataObj.append("genre", formData.genre);
      formDataObj.append("language", formData.language);
      formDataObj.append("status", formData.status);
      formDataObj.append("tags", formData.tags);

      if (formData.coverFile) {
        formDataObj.append("cover", formData.coverFile);
      }
      if (formData.pdfFile) {
        formDataObj.append("pdf", formData.pdfFile);
      }

      await updateBook({ bookId, body: formDataObj }).unwrap();
      toast.success("Book updated successfully");
      router.push("/admin/books");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update book";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="text-sm text-gray-500">Loading book...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !book) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="space-y-6 px-4 py-8 lg:py-10">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium mb-4">Book not found</p>
            <Link href="/admin/books">
              <Button className="bg-red-600 hover:bg-red-700">
                Back to Books
              </Button>
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6 px-4 py-8 lg:py-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Book</h1>
            <p className="mt-1 text-sm text-gray-500">{book?.title}</p>
          </div>
          <Link href="/admin/books">
            <Button variant="outline">Back to Books</Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              Basic Information
            </h2>
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <Input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Book title"
                    error={errors.title}
                    className="w-full"
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-600">{errors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Author
                  </label>
                  <Input
                    type="text"
                    name="author"
                    value={formData.author}
                    onChange={handleChange}
                    placeholder="Author name"
                    error={errors.author}
                    className="w-full"
                  />
                  {errors.author && (
                    <p className="mt-1 text-xs text-red-600">{errors.author}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Brief description of the book"
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre
                  </label>
                  <Input
                    type="text"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    placeholder="e.g., Programming, Fiction"
                    error={errors.genre}
                    className="w-full"
                  />
                  {errors.genre && (
                    <p className="mt-1 text-xs text-red-600">{errors.genre}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="it">Italian</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <Input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="e.g., javascript, web, tutorial"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Files */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Files</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cover Image
                </label>
                {book?.coverUrl && (
                  <div className="mb-4">
                    <div className="relative h-40 w-32 overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={book.coverUrl}
                        alt={book.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Current cover</p>
                  </div>
                )}
                <input
                  type="file"
                  name="coverFile"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Upload a new cover image (PNG, JPG, etc.)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PDF File
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Current PDF: {book?.pdfUrl ? "Set" : "Not set"}
                </p>
                <input
                  type="file"
                  name="pdfFile"
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Upload a new PDF file
                </p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              Settings
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="mb-4 text-sm font-medium text-gray-900">
                Uploading files...
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isUpdatingBook}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isUpdatingBook ? "Saving..." : "Save Changes"}
            </Button>
            <Link href="/admin/books">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
