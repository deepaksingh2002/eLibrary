import React, { useState } from "react";
import Link from "next/link";
import { useRecommendations } from "../hooks/useRecommendations";
import { RecommendationCard } from "./RecommendationCard";
import { AIExplanationModal } from "./AIExplanationModal";
import { Spinner } from "./ui/Spinner";

interface RecommendationsShelfProps {
  title?: string;
  showRefresh?: boolean;
}

export const RecommendationsShelf: React.FC<RecommendationsShelfProps> = ({
  title = "Recommended for You",
  showRefresh = false
}) => {
  const { recommendations, isColdStart, computedAt, isLoading, refresh, isRefreshing } = useRecommendations();
  const [explanationBookId, setExplanationBookId] = useState<string | null>(null);
  const [explanationBookTitle, setExplanationBookTitle] = useState("");

  const timeAgo = (dateStr: string) => {
    const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-gray-900 text-xl">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="w-44 h-72 animate-pulse bg-gray-100 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <section>
        <h2 className="font-bold text-gray-900 text-xl mb-4">{title}</h2>
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <p className="font-medium text-gray-900">No recommendations yet</p>
          <p className="text-gray-500 text-sm mt-1 mb-4">Read and rate some books to get personalized picks</p>
          <Link href="/search" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Browse books →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-gray-900 text-xl">{title}</h2>
          {isColdStart ? (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">Based on top picks</span>
          ) : (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">Personalized</span>
          )}
        </div>
        
        {showRefresh && (
          <div className="flex items-center gap-3">
            {computedAt && (
              <span className="text-xs text-gray-400 hidden sm:inline">Updated {timeAgo(computedAt)}</span>
            )}
            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              {isRefreshing ? (
                <>
                  <Spinner size="sm" />
                  <span>Refreshing...</span>
                </>
              ) : (
                "↻ Refresh"
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {recommendations.map(rec => (
          <RecommendationCard
            key={rec.book._id}
            recommendation={rec}
            onExplain={(id) => {
              setExplanationBookId(id);
              setExplanationBookTitle(rec.book.title);
            }}
            isExplaining={explanationBookId == rec.book._id}
          />
        ))}
      </div>

      <AIExplanationModal
        bookId={explanationBookId}
        bookTitle={explanationBookTitle}
        onClose={() => setExplanationBookId(null)}
      />
    </section>
  );
};
