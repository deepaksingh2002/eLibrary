"use client";

import FileUploadZone from "./FileUploadZone";
import { BOOK_GENRES, BOOK_LANGUAGES, BookFormErrors, BookFormValues } from "../../hooks/useBookForm";

interface Props {
  values: BookFormValues;
  errors: BookFormErrors;
  isEditMode: boolean;
  previewCoverUrl?: string;
  onChange: <K extends keyof BookFormValues>(field: K, value: BookFormValues[K]) => void;
}

export default function BookFormFields({
  values,
  errors,
  isEditMode,
  previewCoverUrl,
  onChange
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Book Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder="e.g. Introduction to Algorithms"
          className={[
            "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all",
            errors.title
              ? "border-red-400 bg-red-50 focus:border-red-500"
              : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          ].join(" ")}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-500">{errors.title}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Author <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.author}
          onChange={(event) => onChange("author", event.target.value)}
          placeholder="e.g. Thomas H. Cormen"
          className={[
            "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all",
            errors.author
              ? "border-red-400 bg-red-50 focus:border-red-500"
              : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          ].join(" ")}
        />
        {errors.author && (
          <p className="mt-1 text-xs text-red-500">{errors.author}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Genre <span className="text-red-500">*</span>
          </label>
          <select
            value={values.genre}
            onChange={(event) => onChange("genre", event.target.value)}
            className={[
              "w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none transition-all",
              errors.genre
                ? "border-red-400 bg-red-50"
                : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            ].join(" ")}
          >
            <option value="">Select genre...</option>
            {BOOK_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
          {errors.genre && (
            <p className="mt-1 text-xs text-red-500">{errors.genre}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Language
          </label>
          <select
            value={values.language}
            onChange={(event) => onChange("language", event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {BOOK_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder="Write a brief description of this book..."
          rows={4}
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {values.description.length} / 2000
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Tags
          <span className="ml-1 font-normal text-gray-400">(comma separated)</span>
        </label>
        <input
          type="text"
          value={values.tags}
          onChange={(event) => onChange("tags", event.target.value)}
          placeholder="javascript, algorithms, data structures"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {values.tags.trim() && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {values.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
              .map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  #{tag}
                </span>
              ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Publishing Status
        </label>
        <div className="flex gap-3">
          {(["draft", "published"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onChange("status", status)}
              className={[
                "flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium capitalize transition-all",
                values.status === status
                  ? status === "published"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-700 bg-gray-700 text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              ].join(" ")}
            >
              {status === "published" ? "Published" : "Draft"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {values.status === "published"
            ? "Visible to all users immediately after saving"
            : "Saved privately and hidden until published"}
        </p>
      </div>

      <div className="grid gap-6 pt-2 md:grid-cols-2">
        <FileUploadZone
          label={`Cover Image${isEditMode ? " (optional - replaces current)" : " (optional)"}`}
          accept="image/jpeg,image/png,image/webp,image/*"
          file={values.coverFile}
          error={errors.cover}
          maxSizeMB={5}
          hint="JPG, PNG, WebP - 400x560 recommended"
          previewUrl={isEditMode ? previewCoverUrl : undefined}
          onChange={(file) => onChange("coverFile", file)}
        />

        <FileUploadZone
          label={`PDF File${isEditMode ? " (optional - replaces current)" : " *"}`}
          accept="application/pdf,.pdf"
          file={values.pdfFile}
          error={errors.pdf}
          maxSizeMB={50}
          hint={isEditMode ? "Leave empty to keep the existing PDF" : "PDF files only - Max 50MB"}
          onChange={(file) => onChange("pdfFile", file)}
        />
      </div>
    </div>
  );
}
