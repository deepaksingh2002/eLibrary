"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import {
  useGetBookQuery,
  useGetReadingProgressQuery,
  useDownloadBookMutation,
  useUpdateReadingProgressMutation,
} from "../../../../../store/services/api";
import { useAuthStore } from "../../../../../store/authStore";
import { Spinner } from "../../../../../components/ui/Spinner";
import AIStudyPanel from "../../../../../components/reader/AIStudyPanel";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";
import { getApiErrorMessage } from "../../../../../lib/getApiErrorMessage";

function isRenderingCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "RenderingCancelledException";
}

export default function ReadPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [downloadBook] = useDownloadBookMutation();
  const [updateReadingProgress] = useUpdateReadingProgressMutation();

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPdfUnavailable, setIsPdfUnavailable] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [pageInputValue, setPageInputValue] = useState("1");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedProgressRef = useRef(0);
  const returnUrl = `/book/${id}/read`;

  // Redirect if not authenticated
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [hasHydrated, isAuthenticated, id, router, returnUrl]);

  // Auto-dismiss keyboard hint
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch book info
  const { data: bookData } = useGetBookQuery(id, { skip: !id });
  const book = bookData?.book;

  // Fetch saved progress (wait for hydration before enabling)
  const { data: progressData } = useGetReadingProgressQuery(id, {
    skip: !hasHydrated || !id || !isAuthenticated,
  });

  useEffect(() => {
    if (typeof progressData?.progress === "number") {
      savedProgressRef.current = progressData.progress;
    }
  }, [progressData?.progress]);

  // Load PDF document
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !id) return;

    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    setIsPdfUnavailable(false);

    const loadPDF = async () => {
      try {
        const { getPdfjsLib } = await import("../../../../../lib/pdfWorker");
        const lib = await getPdfjsLib();

        const apiBaseUrl = getApiBaseUrl();
        const token = useAuthStore.getState().accessToken;

        const streamResponse = await fetch(
          `${apiBaseUrl}/api/books/${id}/pdf`,
          {
            method: "GET",
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );

        if (streamResponse.ok) {
          const pdfBytes = new Uint8Array(await streamResponse.arrayBuffer());
          const loadingTask = lib.getDocument({ data: pdfBytes });
          const doc = await loadingTask.promise;

          if (!isActive) {
            await doc.destroy();
            return;
          }

          setPdfDoc(doc);
          setTotalPages(doc.numPages);

          const savedProgress = savedProgressRef.current;
          if (savedProgress > 0 && savedProgress < 100) {
            const savedPage = Math.ceil((savedProgress / 100) * doc.numPages)
            setCurrentPage(savedPage)
            setPageInputValue(String(savedPage))
          } else {
            setCurrentPage(1)
            setPageInputValue("1")
          }

          return;
        }

        console.warn(
          "[PDF] Streaming endpoint failed, falling back to direct download URL:",
          streamResponse.status,
        );

        let downloadUrl = "";

        try {
          const downloadRes = await downloadBook(id).unwrap();
          downloadUrl = downloadRes?.downloadUrl || "";
        } catch (downloadError) {
          console.warn("[PDF] Download API failed, trying direct PDF URL:", downloadError);
        }

        if (!downloadUrl && book?.pdfUrl) {
          downloadUrl = book.pdfUrl;
        }

        if (!downloadUrl) {
          throw new Error("Failed to get download URL");
        }

        const loadingTask = lib.getDocument({ url: downloadUrl });

        const doc = await loadingTask.promise;
        if (!isActive) {
          await doc.destroy();
          return;
        }

        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // Restore saved progress
        const savedProgress = savedProgressRef.current;
        if (savedProgress > 0 && savedProgress < 100) {
          const savedPage = Math.ceil((savedProgress / 100) * doc.numPages)
          setCurrentPage(savedPage)
          setPageInputValue(String(savedPage))
        } else {
          setCurrentPage(1)
          setPageInputValue("1")
        }
      } catch (err: unknown) {
        console.error("[PDF] Load error:", err);
        const message = getApiErrorMessage(err, "");

        if (message.includes("PDF not available for this book")) {
          setIsPdfUnavailable(true);
          setLoadError(null);
        } else {
          setLoadError("Failed to load PDF. Please try again.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadPDF();
    return () => {
      isActive = false;
    };
  }, [id, hasHydrated, isAuthenticated, downloadBook, book?.pdfUrl]);

  // Render page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel in-progress render
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch {}
      }

      setIsRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = { canvas, canvasContext: context, viewport };
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
      } catch (err: unknown) {
        if (!isRenderingCancelled(err)) {
        }
      } finally {
        setIsRendering(false);
      }
    },
    [pdfDoc, scale]
  );

  useEffect(() => {
    renderPage(currentPage);
  }, [pdfDoc, currentPage, scale, renderPage]);

  // Sync progress with debounce
  useEffect(() => {
    if (!totalPages || !hasHydrated || !isAuthenticated) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const newProgress = Math.round((currentPage / totalPages) * 100);
      try {
        await updateReadingProgress({
          bookId: id,
          body: {
            progress: newProgress,
            sessionMinutes: 0,
          },
        }).unwrap();
      } catch {
      }
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentPage, totalPages, id, hasHydrated, isAuthenticated, updateReadingProgress]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentPage((prev) => {
          const next = Math.min(totalPages, prev + 1);
          setPageInputValue(String(next));
          return next;
        });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentPage((prev) => {
          const next = Math.max(1, prev - 1);
          setPageInputValue(String(next));
          return next;
        });
      }
      if (e.key === "+" || e.key === "=") {
        setScale((prev) => Math.min(3.0, +(prev + 0.2).toFixed(1)));
      }
      if (e.key === "-") {
        setScale((prev) => Math.max(0.5, +(prev - 0.2).toFixed(1)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(clamped);
    setPageInputValue(String(clamped));
  };

  const progressPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner size="lg" />
          <p className="text-sm text-gray-300">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "100vh", backgroundColor: "#111827" }}>
      {/* Fixed Toolbar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 gap-2"
        style={{ backgroundColor: "#1f2937", height: "56px", borderBottom: "1px solid #374151" }}
      >
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            ← Back
          </button>
          {book && (
            <span className="text-gray-300 text-sm truncate max-w-[160px] hidden sm:block">
              {book.title}
            </span>
          )}
        </div>

        {/* Center — page navigation */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors text-lg"
          >
            ‹
          </button>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              goToPage(isNaN(val) ? currentPage : val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt(pageInputValue);
                goToPage(isNaN(val) ? currentPage : val);
              }
            }}
            className="text-center text-white text-sm rounded px-1 py-0.5 w-12"
            style={{ backgroundColor: "#374151", border: "none", outline: "none" }}
          />
          <span className="text-gray-400 text-sm">/ {totalPages}</span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors text-lg"
          >
            ›
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Zoom — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setScale((prev) => Math.max(0.5, +(prev - 0.2).toFixed(1)))}
              className="text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              −
            </button>
            <span className="text-gray-300 text-sm w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((prev) => Math.min(3.0, +(prev + 0.2).toFixed(1)))}
              className="text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              +
            </button>
          </div>

          {/* Progress badge */}
          {totalPages > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 font-medium">
              {progressPercent}%
            </span>
          )}
        </div>
      </header>

      {/* Canvas area */}
      <main
        className="flex-1 overflow-auto flex items-start justify-center"
        style={{ paddingTop: "56px", backgroundColor: "#111827" }}
      >
        {/* Loading state */}
        {(isLoading || isRendering) && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Spinner size="lg" />
            <p className="text-gray-400 text-sm">
              {isLoading ? "Loading PDF..." : "Rendering page..."}
            </p>
          </div>
        )}

        {/* PDF unavailable state */}
        {isPdfUnavailable && !isLoading && book && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6 max-w-xl mx-auto">
            <div className="text-5xl">📚</div>
            <h2 className="text-2xl font-bold text-white">Reading not available yet</h2>
            <p className="text-gray-300 text-sm leading-6">
              This book is in the library, but a PDF has not been uploaded yet.
              You can still view the book details page, or come back after an admin uploads the file.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => router.push(`/book/${id}`)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                View Book Details
              </button>
              <button
                onClick={() => router.back()}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {loadError && !isLoading && !isPdfUnavailable && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-6">
            <div className="text-5xl">📄</div>
            <p className="text-red-400 font-medium">{loadError}</p>
            <button
              onClick={() => router.back()}
              className="text-gray-300 text-sm hover:text-white transition-colors"
            >
              ← Go back
            </button>
          </div>
        )}

        {/* PDF Canvas */}
        <div className={`py-6 px-4 ${isLoading || loadError || isPdfUnavailable ? "hidden" : ""}`}>
          <canvas
            ref={canvasRef}
            className="block mx-auto shadow-2xl"
            style={{ maxWidth: "100%" }}
          />
        </div>
      </main>

      {/* ADD: AI Study Panel (floating button + panel) */}
      {book && (
        <AIStudyPanel bookId={id} bookTitle={book.title || ""} />
      )}

      {/* Keyboard hint toast */}
      {showHint && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-gray-200 text-xs px-4 py-2 rounded-full shadow-lg transition-all"
          style={{ pointerEvents: "none" }}
        >
          Use ← → arrow keys to navigate pages • +/− to zoom
        </div>
      )}
    </div>
  );
}
