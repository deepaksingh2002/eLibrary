"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../components/ui/Toast";
import api from "../../../lib/api";
import { DashboardData, UserStats } from "../../../types";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { StreakBadge } from "../../../components/StreakBadge";
import { GoalProgressWidget } from "../../../components/GoalProgressWidget";
import { WeeklyActivityChart } from "../../../components/WeeklyActivityChart";
import { ActivityFeed } from "../../../components/ActivityFeed";
import { RecommendationsShelf } from "../../../components/RecommendationsShelf";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/users/me/dashboard").then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery<UserStats>({
    queryKey: ["user-stats"],
    queryFn: () => api.get("/api/users/me/stats").then((r) => r.data),
  });

  const goalMutation = useMutation({
    mutationFn: (goal: number) => api.patch("/api/users/me/goal", { monthlyGoal: goal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Reading goal updated!");
    },
  });

  if (isDashboardLoading || isStatsLoading) {
    return (
      <ProtectedRoute>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-8"></div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 h-24 animate-pulse">
                <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-8">
              <div className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
              <div className="h-64 bg-gray-100 rounded-xl animate-pulse"></div>
            </div>
            <div className="lg:col-span-1 space-y-4">
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
              <div className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!dashboard) return null;

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {dashboard.user.name}</h1>
          <p className="text-sm text-gray-400">{dashboard.user.email}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-3xl font-bold text-gray-900">{dashboard.user.totalBooksRead}</div>
                <div className="text-xs text-gray-400 mt-1">all time</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-xl">📚</div>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-3xl font-bold text-gray-900">{Math.round(dashboard.user.totalMinutesRead / 60)}</div>
            <div className="text-xs text-gray-400 mt-1">{dashboard.user.totalMinutesRead} minutes total</div>
          </div>
          <div className={`bg-white border border-gray-100 rounded-xl p-4 ${dashboard.user.streak > 0 ? 'bg-orange-50/30' : ''}`}>
            <div className="text-3xl font-bold text-gray-900">{dashboard.user.streak}</div>
            <div className="text-xs text-gray-400 mt-1">days</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-3xl font-bold text-gray-900 capitalize truncate">{stats?.favouriteGenre || "—"}</div>
            <div className="text-xs text-gray-400 mt-1">most read</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="font-bold text-gray-900 mb-4">Continue Reading</h2>
              {dashboard.continueReading.length === 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 text-center">
                  <p className="text-gray-600 font-medium">You&apos;re not reading anything right now</p>
                  <p className="text-gray-400 text-sm mb-4">Start a book to see it here</p>
                  <button onClick={() => router.push("/search")} className="text-blue-600 text-sm font-medium hover:underline">
                    Browse books →
                  </button>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  {dashboard.continueReading.map((item) => (
                    <div
                      key={item._id}
                      className="w-36 flex-shrink-0 cursor-pointer group"
                      onClick={() => router.push(`/book/${item.bookId._id}`)}
                    >
                      <div className="w-full aspect-[3/4] relative rounded-lg overflow-hidden border border-gray-200 group-hover:border-blue-400 transition-colors">
                        {item.bookId.coverUrl ? (
                          <Image src={item.bookId.coverUrl} alt={item.bookId.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No cover</span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-xs font-medium line-clamp-2 mt-2 group-hover:text-blue-600 transition-colors">
                        {item.bookId.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{item.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-8">
              <h2 className="font-bold text-gray-900 mb-4">Reading Activity</h2>
              <WeeklyActivityChart weeklyActivity={dashboard.weeklyActivity} />
            </div>

            <div>
              <h2 className="font-bold text-gray-900 mb-4">Recent Activity</h2>
              <ActivityFeed activities={dashboard.recentActivity} />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <StreakBadge
              streak={dashboard.user.streak}
              longestStreak={dashboard.user.longestStreak}
              isActiveToday={dashboard.user.isActiveToday}
            />
            
            <GoalProgressWidget
              goal={dashboard.goalProgress.goal}
              booksCompletedThisMonth={dashboard.goalProgress.booksCompletedThisMonth}
              percentage={dashboard.goalProgress.percentage}
              isGoalSet={dashboard.goalProgress.isGoalSet}
              onGoalChange={(val) => goalMutation.mutate(val)}
            />

            <div className="mt-4">
              <RecommendationsShelf title="Your Picks" showRefresh={true} />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <h3 className="font-medium text-gray-700 mb-3">Reading Stats</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-400">Not started</span>
                  <span className="font-medium text-gray-400">{stats?.byStatus["not-started"] || 0} books</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-blue-500">In progress</span>
                  <span className="font-medium text-blue-500">{stats?.byStatus["in-progress"] || 0} books</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-green-500">Completed</span>
                  <span className="font-medium text-green-500">{stats?.byStatus["completed"] || 0} books</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">Longest session</span>
                  <span className="font-medium text-gray-700">{stats?.longestSessionMinutes || 0} min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {dashboard.recentlyCompleted.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4">Recently Completed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {dashboard.recentlyCompleted.map((item) => (
                <div
                  key={item._id}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => router.push(`/book/${item.bookId._id}`)}
                >
                  <div className="aspect-[3/4] w-full relative">
                    {item.bookId.coverUrl ? (
                      <Image src={item.bookId.coverUrl} alt={item.bookId.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No cover</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {item.bookId.title}
                    </h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5 mb-2">{item.bookId.author}</p>
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      ✓ Completed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
