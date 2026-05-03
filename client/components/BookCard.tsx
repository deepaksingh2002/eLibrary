import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Book } from "../types";
import { Badge } from "./ui/Badge";

interface BookCardProps {
  book: Book;
}

export const BookCard: React.FC<BookCardProps> = ({ book }) => {
  return (
    <Link href={`/book/${book._id}`} className="group block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className="aspect-[3/4] relative w-full bg-gray-200">
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex w-full h-full items-center justify-center text-gray-400">
              {/* Fallback book icon */}
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 line-clamp-2" title={book.title}>
            {book.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-1" title={book.author}>
            {book.author}
          </p>
          
          <div className="mt-2 text-left">
            <Badge variant="info">{book.genre}</Badge>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-yellow-500 font-medium">
              ★ {book.avgRating.toFixed(1)}
            </div>
            <div className="text-gray-500">
              <span className="sr-only">Downloads: </span>
              {book.downloads} ↓
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
