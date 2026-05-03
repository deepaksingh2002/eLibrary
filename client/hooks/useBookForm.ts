"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { toast } from "../components/ui/Toast";

export interface BookFormValues {
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string;
  status: "draft" | "published";
  coverFile: File | null;
  pdfFile: File | null;
}

export interface BookFormErrors {
  title?: string;
  author?: string;
  genre?: string;
  pdf?: string;
  cover?: string;
}

export const BOOK_GENRES = [
  "Programming",
  "Mathematics",
  "Science",
  "Literature",
  "History",
  "Business",
  "Philosophy",
  "Engineering",
  "Medicine",
  "Law",
  "Economics",
  "Psychology",
  "Other"
] as const;

export const BOOK_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" }
] as const;

const EMPTY_FORM: BookFormValues = {
  title: "",
  author: "",
  description: "",
  genre: "",
  language: "en",
  tags: "",
  status: "draft",
  coverFile: null,
  pdfFile: null
};

interface UseBookFormOptions {
  bookId?: string;
  initialData?: Partial<BookFormValues>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useBookForm({ bookId, initialData }: UseBookFormOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(bookId);

  const [values, setValues] = useState<BookFormValues>({
    ...EMPTY_FORM,
    ...initialData
  });
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (initialData) {
      setValues((current) => ({
        ...current,
        ...initialData
      }));
    }
  }, [JSON.stringify(initialData)]);

  function setField<K extends keyof BookFormValues>(field: K, value: BookFormValues[K]) {
    setValues((current) => ({
      ...current,
      [field]: value
    }));

    if (errors[field as keyof BookFormErrors]) {
      setErrors((current) => ({
        ...current,
        [field]: undefined
      }));
    }
  }

  function validate(): boolean {
    const nextErrors: BookFormErrors = {};

    if (!values.title.trim()) nextErrors.title = "Title is required";
    if (!values.author.trim()) nextErrors.author = "Author is required";
    if (!values.genre) nextErrors.genre = "Please select a genre";

    if (!isEditMode && !values.pdfFile) {
      nextErrors.pdf = "PDF file is required for new books";
    }

    if (values.pdfFile && values.pdfFile.size > 50 * 1024 * 1024) {
      nextErrors.pdf = "PDF must be smaller than 50MB";
    }

    if (values.coverFile && values.coverFile.size > 5 * 1024 * 1024) {
      nextErrors.cover = "Cover image must be smaller than 5MB";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildFormData(): FormData {
    const formData = new FormData();

    formData.append("title", values.title.trim());
    formData.append("author", values.author.trim());
    formData.append("description", values.description.trim());
    formData.append("genre", values.genre);
    formData.append("language", values.language);
    formData.append("status", values.status);

    const tagsArray = values.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    formData.append("tags", JSON.stringify(tagsArray));

    if (values.coverFile) formData.append("cover", values.coverFile);
    if (values.pdfFile) formData.append("pdf", values.pdfFile);

    return formData;
  }

  const createMutation = useMutation({
    mutationFn: (formData: FormData) =>
      api.post("/api/books", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        }
      }),
    onSuccess: () => {
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      toast.success("Book created successfully!");
      router.push("/admin/books");
    },
    onError: (error) => {
      setUploadProgress(0);
      toast.error(getErrorMessage(error, "Failed to create book"));
    }
  });

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      api.patch(`/api/books/${bookId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        }
      }),
    onSuccess: () => {
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      toast.success("Book updated successfully!");
      router.push("/admin/books");
    },
    onError: (error) => {
      setUploadProgress(0);
      toast.error(getErrorMessage(error, "Failed to update book"));
    }
  });

  function handleSubmit() {
    if (!validate()) return;

    setUploadProgress(0);
    const formData = buildFormData();

    if (isEditMode) {
      updateMutation.mutate(formData);
      return;
    }

    createMutation.mutate(formData);
  }

  return {
    values,
    errors,
    uploadProgress,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    isEditMode,
    setField,
    handleSubmit,
    BOOK_GENRES,
    BOOK_LANGUAGES
  };
}
