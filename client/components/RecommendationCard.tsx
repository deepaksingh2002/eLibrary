import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Recommendation } from "../types";
import { Spinner } from "./ui/Spinner";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onExplain: (bookId: string) => void;
  isExplaining: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onExplain,
  isExplaining
}) => {
  const router = useRouter();
  const { book, reason } = recommendation;

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden w-44 flex-shrink-0 cursor-pointer group hover:shadow-md transition-shadow">
      <div className="relative w-full aspect-[3/4] bg-gray-100">
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt={book.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">No Cover</div>
        )}
        
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => router.push(`/book/${book._id}`)}
            className="bg-white text-gray-900 px-4 py-1.5 text-sm font-medium rounded-full hover:bg-gray-50"
          >
            View book
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExplain(book._id);
            }}
            className="text-white bg-transparent border border-white px-3 py-1 text-xs rounded-full hover:bg-white/20 flex items-center justify-center h-7"
          >
            {isExplaining ? <Spinner size="sm" /> : "Why this? ✨"}
          </button>
        </div>

        <div className="absolute top-2 left-2">
          {reason === "collaborative" && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium bg-blue-100 text-blue-800">Picked for you</span>
          )}
          {reason === "cold-start" && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium bg-gray-100 text-gray-800">Top rated</span>
          )}
          {reason === "content-based" && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium bg-purple-100 text-purple-800">Similar</span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
          {book.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
          {book.author}
        </p>
        
        {book.avgRating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-yellow-500">★ {book.avgRating}</span>
            <span className="text-xs text-gray-400">({book.totalReviews})</span>
          </div>
        )}
      </div>
    </div>
  );
};
