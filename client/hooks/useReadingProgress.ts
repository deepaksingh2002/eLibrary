"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import api from "../lib/api";
import { getApiErrorMessage } from "../lib/utils";
import { useHydration } from "./useHydration";
import { useAuthStore } from "../store/authStore";
import { ReadingProgress } from "../types";
import { toast } from "../components/ui/Toast";

export const useReadingProgress = (bookId: string) => {
  const queryClient = useQueryClient();
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

  const { data: progressData, isLoading } = useQuery<ReadingProgress | null>({
    queryKey: ["progress", bookId],
    queryFn: () => api.get(`/api/progress/${bookId}`).then((r) => r.data.progress),
    enabled: isHydrated && !!bookId && !!user,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ value, sessionMinutes }: { value: number; sessionMinutes?: number }) =>
      api.patch(`/api/progress/${bookId}`, {
        progress: value,
        sessionMinutes: sessionMinutes || 0,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(["progress", bookId], response.data.progress);
      queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error) || "Failed to save progress");
    },
  });

  const updateProgress = (value: number, sessionMinutes?: number) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ value, sessionMinutes });
    }, 800);
  };

  const addBookmark = async (page: number, note = "") => {
    try {
      await api.post(`/api/progress/${bookId}/bookmarks`, { page, note });
      queryClient.invalidateQueries({ queryKey: ["progress", bookId] });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to add bookmark";
      toast.error(msg);
      throw error;
    }
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
    progress: progressData ?? null,
    currentValue: progressData?.progress ?? 0,
    status: progressData?.status ?? "not-started",
    bookmarks: progressData?.bookmarks ?? [],
    sessions: progressData?.sessions ?? [],
    isLoading,
    isUpdating: updateMutation.isPending,
    updateProgress,
    addBookmark,
    editBookmark,
    removeBookmark,
  };
};
