"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "../ui/Toast";

interface Props {
  label: string;
  accept: string;
  file: File | null;
  error?: string;
  maxSizeMB: number;
  hint?: string;
  previewUrl?: string;
  onChange: (file: File | null) => void;
}

export default function FileUploadZone({
  label,
  accept,
  file,
  error,
  maxSizeMB,
  hint,
  previewUrl,
  onChange
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string>("");

  const isPdf = accept.includes("pdf");
  const isImage = accept.includes("image");

  useEffect(() => {
    if (!file || !isImage) {
      setObjectUrl("");
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);

    return () => {
      URL.revokeObjectURL(nextObjectUrl);
    };
  }, [file, isImage]);

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFile(nextFile: File) {
    if (nextFile.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${maxSizeMB}MB`);
      return;
    }

    onChange(nextFile);
  }

  const hasFile = Boolean(file);
  const hasPreview = !file && Boolean(previewUrl);
  const imagePreviewSrc = file ? objectUrl : previewUrl;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) {
            handleFile(droppedFile);
          }
        }}
        className={[
          "relative cursor-pointer select-none rounded-xl border-2 border-dashed p-6 text-center transition-all",
          dragging
            ? "border-blue-500 bg-blue-50"
            : hasFile
              ? "border-green-400 bg-green-50"
              : error
                ? "border-red-300 bg-red-50"
                : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) {
              handleFile(selectedFile);
            }
          }}
        />

        {isImage && (hasFile || hasPreview) && imagePreviewSrc && (
          <Image
            src={imagePreviewSrc}
            alt="Selected cover preview"
            width={96}
            height={128}
            unoptimized
            className="mx-auto mb-3 h-32 w-24 rounded-lg border border-gray-200 object-cover shadow-sm"
          />
        )}

        {isPdf && hasFile && (
          <div className="mx-auto mb-3 flex h-20 w-14 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-3">
            <span className="text-lg font-bold text-red-500">PDF</span>
          </div>
        )}

        {!hasFile && !hasPreview && (
          <div className="mb-2 text-4xl">
            {isPdf ? "PDF" : "IMG"}
          </div>
        )}

        {hasFile ? (
          <div>
            <p className="max-w-full truncate text-sm font-medium text-green-700">
              {file!.name}
            </p>
            <p className="mt-0.5 text-xs text-green-600">
              {formatBytes(file!.size)}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              className="mt-2 text-xs text-red-500 underline hover:text-red-700"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {hasPreview ? "Drop new file to replace" : "Drop file here or "}
              {!hasPreview && (
                <span className="font-medium text-blue-600">browse</span>
              )}
            </p>
            {hint && (
              <p className="mt-1 text-xs text-gray-400">{hint}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Max size: {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
