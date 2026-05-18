"use client";

import React, { useEffect, useState } from "react";
import { useGetBookSummaryQuery, useGetBookExplanationQuery } from "../store/services/api";

interface AIExplanationModalProps {
  bookId: string | null;
  bookTitle: string;
  onClose: () => void;
  mode?: "explanation" | "summary";
}

export const AIExplanationModal: React.FC<AIExplanationModalProps> = ({
  bookId,
  bookTitle,
  onClose,
  mode = "explanation",
}) => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isSummary = mode === "summary";

  const summaryQuery = useGetBookSummaryQuery(bookId ?? "", {
    skip: !(isHydrated && !!bookId && isSummary),
  });

  const explanationQuery = useGetBookExplanationQuery(bookId ?? "", {
    skip: !(isHydrated && !!bookId && !isSummary),
  });

  const data = isSummary ? summaryQuery.data : explanationQuery.data;
  const isLoading = isSummary ? summaryQuery.isLoading : explanationQuery.isLoading;
  const isError = isSummary ? summaryQuery.isError : explanationQuery.isError;
  const error = isSummary ? summaryQuery.error : explanationQuery.error;
  const summaryText = data && "summary" in data ? data.summary : undefined;
  const explanationText = data && "explanation" in data ? data.explanation : undefined;
  const keyPoints = data && "keyPoints" in data ? data.keyPoints : undefined;
  const isAIGenerated = Boolean(data && "isAIGenerated" in data && data.isAIGenerated);

  if (!bookId) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-labelledby="ai-modal-title"
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-auto max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 id="ai-modal-title" className="font-bold text-xl text-gray-900">
              {isSummary ? "AI PDF Summary" : "Why this book?"}
            </h2>
            <p className="text-sm text-gray-400 line-clamp-2 mt-1">for {bookTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-bold leading-none"
            aria-label="Close modal"
          >
            x
          </button>
        </div>

        <div className="min-h-[100px] my-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/5" />
              </div>
              <p className="text-xs text-gray-400 mt-4 animate-pulse">
                {isSummary
                  ? "AI is reading the PDF and preparing a summary..."
                  : "AI is analyzing your reading preferences..."}
              </p>
            </div>
          ) : isError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-gray-700 text-sm leading-relaxed font-medium mb-2">
                Could not generate AI content
              </p>
              <p className="text-gray-600 text-sm">
                {isSummary
                  ? "The PDF summary needs access to the PDF and available Gemini API quota."
                  : "But this book is still recommended based on your reading preferences and ratings."}
              </p>
              {error && (
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-amber-200">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
              )}
            </div>
          ) : summaryText || explanationText ? (
            <div>
              <p className="text-gray-800 text-base leading-relaxed mb-4 whitespace-pre-line">
                {summaryText || explanationText}
              </p>

              {Array.isArray(keyPoints) && keyPoints.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {keyPoints.map((point: string, index: number) => (
                    <li key={`${point}-${index}`} className="flex gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {isAIGenerated ? (
                  <span className="text-xs text-purple-600 flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-200">
                    Generated by Gemini AI
                  </span>
                ) : (
                  <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                    {isSummary ? "Fallback summary" : "Based on your reading patterns"}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-gray-600 text-sm">No AI content available</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-700 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <a
            href={`/book/${bookId}`}
            className="flex-1 bg-blue-600 text-white font-medium py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-center"
          >
            View Book
          </a>
        </div>
      </div>
    </div>
  );
};
