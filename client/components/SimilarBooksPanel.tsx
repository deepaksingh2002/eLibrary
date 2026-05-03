import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { Book } from "../types";

export const SimilarBooksPanel: React.FC<{ bookId: string }> = ({ bookId }) => {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["similar-books", bookId],
    queryFn: () => api.get(`/api/recommendations/similar/${bookId}`).then(r => r.data),
    staleTime: 1000 * 60 * 30
  });

  return (
    <section>
      <h2 className="font-bold text-gray-900 mb-4">Similar Books</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 h-20 animate-pulse flex gap-3">
              <div className="w-12 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-2 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.similar?.length === 0 ? (
        <p className="text-gray-400 text-sm">No similar books found</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data?.similar?.map((item: { book: Book; score: number }) => (
            <div
              key={item.book._id}
              onClick={() => router.push(`/book/${item.book._id}`)}
              className="flex gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="relative w-12 h-16 rounded-lg flex-shrink-0 overflow-hidden bg-gray-200">
                {item.book.coverUrl ? (
                  <Image src={item.book.coverUrl} alt={item.book.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">No Cover</div>
                )}
              </div>
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <h3 className="text-sm font-medium line-clamp-2 text-gray-900 leading-tight">
                  {item.book.title}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.book.author}</p>
                <div className="mt-1.5">
                  <span className="text-[10px] text-gray-400">Match</span>
                  <div className="h-1 bg-gray-200 rounded w-full mt-0.5 overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded" 
                      style={{ width: `${Math.min(100, Math.max(0, item.score * 100))}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
