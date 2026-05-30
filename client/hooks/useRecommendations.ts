"use client";

import { useHydration } from "./useHydration";
import { useAuthStore } from "../store/authStore";
import { Recommendation } from "../types";
import { toast } from "../components/ui/Toast";
import {
  useGetRecommendationsQuery,
  useRefreshRecommendationsMutation,
} from "../store/services/api";

export function useRecommendations() {
  const { user } = useAuthStore();
  const isHydrated = useHydration();

  const { data, isLoading, error, refetch } = useGetRecommendationsQuery(undefined, {
    skip: !isHydrated || !user,
    pollingInterval: 0,
  });

  const [refresh, refreshState] = useRefreshRecommendationsMutation();

  const handleRefresh = async () => {
    try {
      await refresh().unwrap();
      toast.success("Recommendations updated!");
      refetch();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "data" in err &&
        typeof (err as { data?: unknown }).data === "object" &&
        (err as { data?: { message?: string } }).data?.message
          ? (err as { data: { message: string } }).data.message
          : err instanceof Error
            ? err.message
            : "Could not refresh.";
      toast.error(msg);
    }
  };

  return {
    recommendations: (data?.recommendations || []) as Recommendation[],
    isColdStart: data?.isColdStart ?? true,
    computedAt: data?.computedAt ?? null,
    isLoading,
    error,
    refresh: handleRefresh,
    isRefreshing: refreshState.isLoading,
  };
}
