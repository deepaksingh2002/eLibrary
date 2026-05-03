"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { ReadingProgress } from "../types";

export const useReadingProgress = (bookId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: progressData, isLoading } = useQuery<ReadingProgress>({
    queryKey: ["progress", bookId],
    queryFn: async () => {
      console.log("[Progress] Fetching progress for book:", bookId);
      try {
        const response = await api.get(`/api/progress/${bookId}`);
        console.log("[Progress] Fetched progress data:", response.data);
        return response.data;
      } catch (error) {
        console.error("[Progress] Error fetching progress:", error);
        throw error;
      }
    },
    // Fetch once the client is hydrated and we have a bookId.
    // Do not gate on `user` here — token refresh/reauth is handled by the API layer.
    enabled: isHydrated && !!bookId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ value, sessionMinutes }: { value: number; sessionMinutes?: number }) =>
      api.patch(`/api/progress/${bookId}`, {
        progress: value,
        sessionMinutes: sessionMinutes || 0,
      }),
    onSuccess: () => {
      console.log("[Progress] Successfully updated progress");
      queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      console.error("[Progress] Failed to update progress:", error);
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const updateProgress = (value: number, sessionMinutes?: number) => {
    console.log("[Progress] Updating to", value, "with session minutes:", sessionMinutes);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ value, sessionMinutes });
    }, 800);
  };

  const addBookmark = async (page: number, note = "") => {
    await api.post(`/api/progress/${bookId}/bookmarks`, { page, note });
    queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
  };

  const editBookmark = async (bookmarkId: string, note: string) => {
    await api.patch(`/api/progress/${bookId}/bookmarks/${bookmarkId}`, { note });
    queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
  };

  const removeBookmark = async (bookmarkId: string) => {
    await api.delete(`/api/progress/${bookId}/bookmarks/${bookmarkId}`);
    queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
  };

  return {
    progress: progressData || null,
    isLoading,
    updateProgress,
    bookmarks: progressData?.bookmarks || [],
    addBookmark,
    editBookmark,
    removeBookmark,
  };
};
