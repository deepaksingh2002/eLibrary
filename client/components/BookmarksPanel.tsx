"use client";

import React, { useState } from "react";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { Button } from "./ui/Button";

export const BookmarksPanel: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { bookmarks, addBookmark, editBookmark, removeBookmark } = useReadingProgress(bookId);
  const [isOpen, setIsOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const pageNum = parseInt(pageInput, 10);
    if (!pageNum || pageNum < 1) return;

    if (bookmarks.some(b => b.page === pageNum)) {
      setErrorMsg("Bookmark for this page already exists");
      return;
    }

    try {
      await addBookmark(pageNum, noteInput);
      setPageInput("");
      setNoteInput("");
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to add bookmark");
    }
  };

  const handleSaveEdit = async (id: string) => {
    await editBookmark(id, editNote);
    setEditingId(null);
  };

  const sortedBookmarks = [...bookmarks].sort((a, b) => a.page - b.page);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(!isOpen)}>
        🔖 Bookmarks ({bookmarks.length})
      </Button>

      {isOpen && (
        <div className="fixed right-0 md:right-4 bottom-0 md:bottom-4 top-auto md:top-20 w-full md:w-80 h-[60vh] md:h-auto bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-gray-100 z-40 flex flex-col transition-transform">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Bookmarks</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>

          <div className="p-4 border-b border-gray-50 bg-gray-50">
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="number"
                min={1}
                required
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                placeholder="Page"
                className="min-w-16 rounded border-gray-300 text-sm py-1.5 px-2 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 rounded border-gray-300 text-sm py-1.5 px-2 outline-none focus:ring-1 focus:ring-blue-500 min-w-36"
              />
              <Button type="submit" variant="primary" size="sm">Add</Button>
            </form>
            {errorMsg && <p className="text-red-500 text-xs mt-1">{errorMsg}</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sortedBookmarks.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-4">No bookmarks yet</p>
            ) : (
              sortedBookmarks.map((bm) => (
                <div key={bm._id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-0.5 rounded">
                      P.{bm.page}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(bm._id);
                          setEditNote(bm.note);
                        }}
                        className="text-gray-400 hover:text-blue-600 text-xs px-1"
                        aria-label="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeBookmark(bm._id)}
                        className="text-gray-400 hover:text-red-600 text-xs px-1"
                        aria-label="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  
                  {editingId === bm._id ? (
                    <div className="mt-2">
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full text-sm border rounded p-1"
                        rows={2}
                      />
                      <div className="flex gap-2 mt-1">
                        <Button size="sm" variant="primary" onClick={() => handleSaveEdit(bm._id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-1">{bm.note}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-400">
                    {formatTimeAgo(bm.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
