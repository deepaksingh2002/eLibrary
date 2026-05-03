"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import api from "../../../../../lib/api";
import { useAuthStore } from "../../../../../store/authStore";
import { Spinner } from "../../../../../components/ui/Spinner";

function isRenderingCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "RenderingCancelledException";
}

export default function ReadPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const { user, isAuthenticated } = useAuthStore();

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [pageInputValue, setPageInputValue] = useState("1");
  const [isHydrated, setIsHydrated] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track hydration state
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push(`/login?returnUrl=/book/${id}/read`);
    }
  }, [isHydrated, isAuthenticated, id, router]);

  // Auto-dismiss keyboard hint
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch book info
  const { data: book } = useQuery({
    queryKey: ["book", id],
    queryFn: () => api.get(`/api/books/${id}`).then((r) => r.data.book),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch saved progress (wait for hydration before enabling)
  const { data: progressData } = useQuery({
    queryKey: ["progress", id],
    queryFn: () => api.get(`/api/progress/${id}`).then((r) => r.data),
    enabled: isHydrated && !!id,
    staleTime: 1000 * 60 * 5,
  });

  // Download URL is fetched on-demand when loading PDF, not on page load

  // Load PDF document
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const loadPDF = async () => {
      try {
        // Fetch download URL (signed URL to Cloudinary PDF)
        const downloadRes = await api.post(`/api/books/${id}/download`);
        const downloadUrl = downloadRes.data?.downloadUrl;
        
        if (!downloadUrl) {
          throw new Error("Failed to get download URL");
        }

        const { getPdfjsLib } = await import("../../../../../lib/pdfWorker");
        const lib = await getPdfjsLib();

        const loadingTask = lib.getDocument({
          url: downloadUrl,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // Restore saved progress
        console.log(`[Progress] Loaded - progress=${progressData?.progress}%, totalPages=${doc.numPages}`);
        if (progressData?.progress > 0 && progressData.progress < 100) {
          const savedPage = Math.ceil((progressData.progress / 100) * doc.numPages);
          console.log(`[Progress] Restoring to page ${savedPage}`);
          setCurrentPage(savedPage);
          setPageInputValue(String(savedPage));
        } else {
          console.log(`[Progress] Starting from page 1`);
          setCurrentPage(1);
          setPageInputValue("1");
        }
      } catch (err: unknown) {
        console.error("[PDF] Load error:", err);
        setLoadError("Failed to load PDF. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [id, progressData]);

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
          console.error("[PDF] Render error:", err);
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
    if (!totalPages || !isHydrated) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const newProgress = Math.round((currentPage / totalPages) * 100);
      console.log(`[Progress] Syncing - Page ${currentPage}/${totalPages} = ${newProgress}%`);
      try {
        const response = await api.patch(`/api/progress/${id}`, { 
          progress: newProgress, 
          sessionMinutes: 0 
        });
        console.log(`[Progress] Successfully saved:`, response.data);
        // Invalidate progress query so detail page refetches latest progress
        console.log(`[Progress] Invalidating query for detail page`);
        queryClient.invalidateQueries({ queryKey: ["progress", id] });
        console.log(`[Progress] Query invalidated`);
      } catch (error) {
        console.error(`[Progress] Failed to save:`, error);
      }
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentPage, totalPages, id, isHydrated, queryClient]);

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

  if (!isAuthenticated) return null;

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

        {/* Error state */}
        {loadError && !isLoading && (
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
        <div className={`py-6 px-4 ${isLoading || loadError ? "hidden" : ""}`}>
          <canvas
            ref={canvasRef}
            className="block mx-auto shadow-2xl"
            style={{ maxWidth: "100%" }}
          />
        </div>
      </main>

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
