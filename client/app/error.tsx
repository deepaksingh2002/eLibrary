"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="text-6xl mb-4">⚠️</div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 mb-6 max-w-sm text-sm">
        An unexpected error occurred. You can try again or go back home.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-300 font-mono mb-6">{error.digest}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="bg-white text-gray-700 px-5 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
