"use client";

import { useEffect, useState } from "react";
import { toast } from "../components/ui/Toast";
import { useAddSmartBookMutation, useSearchSmartBooksQuery } from "../store/services/api";

export interface SearchedBook {
  externalId: string;
  source: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string[];
  coverUrl: string;
  pdfUrl: string;
  previewUrl: string;
  pageCount: number;
  publishedYear: string;
  publisher: string;
  isbn: string;
  aiEnhanced: boolean;
  alreadyExists: boolean;
}

export function useSmartImport() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isFetching } = useSearchSmartBooksQuery(
    { q: searchTerm, limit: 12 },
    { skip: searchTerm.trim().length < 2 }
  );
  const [addSmartBook] = useAddSmartBookMutation();

  useEffect(() => {
    if (data?.results) {
      setResults(data.results);
    }
  }, [data]);

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message || fallback;
    }

    return fallback;
  }

  const search = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      return;
    }

    setLoading(true);
    setSearched(true);
    setResults([]);
    setSearchTerm(trimmed);
    setLoading(false);
  };

  const addBook = (book: SearchedBook) => {
    if (book.alreadyExists) {
      toast.info("This book already exists in your library.");
      return;
    }

    setAddingId(book.externalId);
    addSmartBook({
      ...book,
      status: "draft",
    })
      .unwrap()
      .then((response) => {
        setAddingId(null);
        setResults((current) =>
          current.map((item) =>
            item.externalId === book.externalId ? { ...item, alreadyExists: true } : item
          )
        );

        if (response.needsPdf) {
          toast.success(`"${book.title}" added! Upload PDF in the edit page.`);
        } else {
          toast.success(`"${book.title}" added with PDF!`);
        }
      })
      .catch((error) => {
        setAddingId(null);
        const message = getErrorMessage(error, `Failed to add "${book.title}"`);
        toast.error(message);
      });
  };

  return {
    query,
    setQuery,
    results,
    loading: loading || isFetching,
    searched,
    addingId,
    search,
    addBook
  };
}