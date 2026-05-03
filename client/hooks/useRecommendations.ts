"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Recommendation, RecommendationsResponse } from "../types";
import { toast } from "../components/ui/Toast";

export function useRecommendations() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data, isLoading, error } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      try {
        console.log("[useRecommendations] Fetching recommendations for user:", user?.id);
        const response = await api.get("/api/recommendations");
        console.log("[useRecommendations] Successfully fetched recommendations:", response.data);
        return response.data;
      } catch (err) {
        console.error("[useRecommendations] Error fetching recommendations:", err);
        throw err;
      }
    },
    enabled: isHydrated && !!user,
    staleTime: 1000 * 60 * 10,
    retry: 2
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post("/api/recommendations/refresh").then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Recommendations refreshed!");
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Please try again later";
      toast.error(msg);
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
