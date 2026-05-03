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
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Could not refresh. Please try again later.";
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
