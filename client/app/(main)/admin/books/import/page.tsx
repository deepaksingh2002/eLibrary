"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import api from "../../../../../lib/api";
import { BulkImportResult } from "../../../../../types";
import { toast } from "../../../../../components/ui/Toast";
import { ProtectedRoute } from "../../../../../components/ProtectedRoute";

interface BookImportItem {
  title: string;
  author: string;
  genre: string;
  language?: string;
  status?: string;
  pdfUrl: string;
  coverUrl?: string;
}

export default function BulkImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedBooks, setParsedBooks] = useState<BookImportItem[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: (books: BookImportItem[]) =>
      api.post("/api/admin/books/bulk-import", { books }).then(r => r.data),
    onSuccess: (result: BulkImportResult) => {
      setImportResult(result);
      toast.success("Import processed");
    },
    onError: () => toast.error("Import failed. Check your JSON format.")
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setParseError(null);
    setParsedBooks(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsed = JSON.parse(result);
        
        if (!Array.isArray(parsed)) {
          throw new Error("JSON file must contain an array of books");
        }
        
        setParsedBooks(parsed);
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : "Failed to parse JSON file");
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        title: "Example Book Title",
        author: "Author Name",
        genre: "Programming",
        description: "Brief description of the book",
        language: "en",
        tags: ["javascript", "web"],
        pdfUrl: "https://example.com/book.pdf",
        coverUrl: "https://example.com/cover.jpg",
        status: "draft"
      }
    ];
    
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elibrary-import-template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setParsedBooks(null);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (importResult) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Import Results</h1>
        
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ✓
          </div>
          <h2 className="font-bold text-2xl text-gray-900 mb-2">
            {importResult.imported} books imported successfully
          </h2>
          
          {importResult.failed > 0 && (
            <p className="text-red-600 font-medium mb-6">
              {importResult.failed} items failed to import
            </p>
          )}

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-8 text-left border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm border-b border-gray-200">
                Error Details
              </div>
              <div className="max-h-64 overflow-y-auto p-0">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-white border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-medium w-16">Row #</th>
                      <th className="px-4 py-2 font-medium">Title</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((err: { index: number, title?: string, reason: string }, i: number) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{err.index}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{err.title || "(untitled)"}</td>
                        <td className="px-4 py-2 text-red-600">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-center gap-4">
            <button 
              onClick={resetState}
              className="px-6 py-2 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Import more
            </button>
            <button 
              onClick={() => router.push("/admin/books")}
              className="px-6 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Books
            </button>
          </div>
        </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import Books</h1>
        <button 
          onClick={handleDownloadTemplate}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Download JSON template
        </button>
      </div>

      {!parsedBooks ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-16 cursor-pointer hover:bg-gray-50 transition-colors group"
          >
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl group-hover:scale-110 transition-transform">
              ⬆
            </div>
            <p className="text-gray-900 font-medium text-lg">Drop a JSON file here or click to browse</p>
            <p className="text-gray-400 mt-2 text-sm">Must be an array of book objects</p>
          </div>

          {parseError && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl inline-block text-sm">
              <span className="font-medium">Error reading file:</span> {parseError}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900">Preview: {parsedBooks.length} items found</h2>
            <div className="flex gap-3">
              <button 
                onClick={resetState}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Clear
              </button>
              <button 
                onClick={() => importMutation.mutate(parsedBooks)}
                disabled={importMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-xl disabled:opacity-50"
              >
                {importMutation.isPending ? "Importing..." : "Looks good, import now"}
              </button>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Genre</th>
                  <th className="px-4 py-3 font-medium">PDF URL</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsedBooks.slice(0, 5).map((book, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{book.title || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{book.author || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{book.genre || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 truncate max-w-[150px]">{book.pdfUrl || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        book.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {book.status || "draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedBooks.length > 5 && (
              <div className="text-center py-3 text-sm text-gray-500 bg-gray-50 border-t border-gray-100">
                ...and {parsedBooks.length - 5} more items
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}
