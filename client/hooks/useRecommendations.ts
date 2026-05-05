"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { getApiErrorMessage } from "../lib/utils";
import { useHydration } from "./useHydration";
import { useAuthStore } from "../store/authStore";
import { Recommendation, RecommendationsResponse } from "../types";
import { toast } from "../components/ui/Toast";

export function useRecommendations() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isHydrated = useHydration();

  const { data, isLoading, error } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations"],
    queryFn: () => api.get("/api/recommendations").then((r) => r.data),
    enabled: isHydrated && !!user,
    staleTime: 1000 * 60 * 10,
    retry: 1
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post("/api/recommendations/refresh").then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Recommendations updated!");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error) || "Could not refresh. Please try again later.");
    },
  });

  return {
    recommendations: (data?.recommendations || []) as Recommendation[],
    isColdStart: data?.isColdStart ?? true,
    computedAt: data?.computedAt ?? null,
    isLoading,
    error,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}
