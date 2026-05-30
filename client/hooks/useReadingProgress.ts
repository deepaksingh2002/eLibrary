"use client";

import { useHydration } from "./useHydration";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { toast } from "../components/ui/Toast";
import {
  useGetReadingProgressQuery,
  useUpdateReadingProgressMutation,
  useAddBookmarkMutation,
  useEditBookmarkMutation,
  useRemoveBookmarkMutation,
} from "../store/services/api";

export const useReadingProgress = (bookId: string) => {
  const { user } = useAuthStore();
  const isHydrated = useHydration();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const { data: progressData, isLoading, refetch } = useGetReadingProgressQuery(bookId, {
    skip: !isHydrated || !bookId || !user,
    pollingInterval: 0,
  });

  const [updateProgressMutation, updateState] = useUpdateReadingProgressMutation();
  const [addBookmark] = useAddBookmarkMutation();
  const [editBookmark] = useEditBookmarkMutation();
  const [removeBookmark] = useRemoveBookmarkMutation();

  const updateProgress = (value: number, sessionMinutes?: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateProgressMutation({ bookId, body: { progress: value, sessionMinutes: sessionMinutes || 0 } })
        .unwrap()
        .then(() => {
          refetch();
        })
        .catch((error: any) => {
          const msg = error?.data?.message || error?.message || "Failed to save progress";
          toast.error(msg);
        });
    }, 800);
  };

  const handleAddBookmark = async (page: number, note = "") => {
    try {
      await addBookmark({ bookId, page, note }).unwrap();
      refetch();
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || "Failed to add bookmark";
      toast.error(msg);
      throw error;
    }
  };

  const handleEditBookmark = async (bookmarkId: string, note: string) => {
    try {
      await editBookmark({ bookId, bookmarkId, note }).unwrap();
      refetch();
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || "Failed to edit bookmark";
      toast.error(msg);
      throw error;
    }
  };

  const handleRemoveBookmark = async (bookmarkId: string) => {
    try {
      await removeBookmark({ bookId, bookmarkId }).unwrap();
      refetch();
    } catch (error: any) {
      const msg = error?.data?.message || error?.message || "Failed to remove bookmark";
      toast.error(msg);
      throw error;
    }
  };

  return {
    progress: progressData ?? null,
    currentValue: progressData?.progress ?? 0,
    status: progressData?.status ?? "not-started",
    bookmarks: progressData?.bookmarks ?? [],
    sessions: progressData?.sessions ?? [],
    isLoading,
    isUpdating: updateState.isLoading,
    updateProgress,
    addBookmark: handleAddBookmark,
    editBookmark: handleEditBookmark,
    removeBookmark: handleRemoveBookmark,
  };
};
