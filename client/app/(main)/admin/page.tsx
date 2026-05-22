"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { api } from "../../../store/services/api";
import { getApiErrorMessage } from "../../../lib/utils";
import { KPIStats, TrendPoint, GenreDistributionItem, GrowthPoint, AdminBook } from "../../../types";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { toast } from "../../../components/ui/Toast";
import { useAuthStore } from "../../../store/authStore";

export default function AdminDashboardPage() {
  const [exporting, setExporting] = useState<"books" | "users" | null>(null);

  const { data: kpisData, isLoading: kpisLoading } = api.useGetAdminKpisQuery();
  const kpis = kpisData as KPIStats | undefined;

  const [trendPeriod, setTrendPeriod] = useState<"7d" | "30d" | "90d" | "12m">("30d");
  const { data: trendData, isLoading: trendLoading } = api.useGetAdminTrendQuery(trendPeriod);
  const trend = trendData as { trend: TrendPoint[]; period: string } | undefined;

  const { data: topBooksData, isLoading: topBooksLoading } = api.useGetAdminTopBooksQuery();
  const topBooks = topBooksData as { books: AdminBook[]; metric: string } | undefined;

  const { data: genresData, isLoading: genresLoading } = api.useGetAdminGenresQuery();
  const genres = genresData as { distribution: GenreDistributionItem[]; total: number } | undefined;

  const { data: userGrowthData, isLoading: userGrowthLoading } = api.useGetAdminUserGrowthQuery();
  const userGrowth = userGrowthData as { growth: GrowthPoint[]; period: string } | undefined;

  const COLORS = [
    "#2563EB", "#7C3AED", "#DC2626", "#D97706",
    "#059669", "#0891B2", "#DB2777", "#65A30D"
  ];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const downloadCsv = async (type: "books" | "users") => {
    setExporting(type);
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/admin/export/${type}?format=csv`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) throw new Error("Export failed");

      const contentDisposition = response.headers.get("content-disposition") || "";
      const filenameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
      const fallbackName = `elibrary-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      const filename = filenameMatch?.[1] || fallbackName;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${type === "books" ? "Books" : "Users"} CSV exported`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="font-bold text-gray-900">Download Trends</h2>
        <div className="flex gap-2 bg-gray-50 p-1 rounded-full">
          {(["7d", "30d", "90d", "12m"] as const).map((p) => (
            <button
              key={p}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                trendPeriod === p ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
              onClick={() => setTrendPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {trendLoading ? (
          <div className="h-[280px] w-full bg-gray-50 animate-pulse rounded-xl" />
        ) : mounted ? (
          <div className="h-[280px] w-full" style={{ minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend?.trend || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    if (trendPeriod === "12m") return d.toLocaleDateString("en", { month: "short" });
                    return d.toLocaleDateString("en", { month: "short", day: "numeric" });
                  }}
                  tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis tick={{ fontSize: 12, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={45} dx={-10} />
                <RechartsTooltip
                  contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 13 }}
                  formatter={(val) => [Number(val ?? 0).toLocaleString(), "Downloads"]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}
                />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] w-full bg-gray-50 rounded-xl" />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-bold text-gray-900 mb-6">Books by Genre</h2>
          {genresLoading ? (
            <div className="h-[280px] w-full bg-gray-50 animate-pulse rounded-xl" />
          ) : genres?.distribution?.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-400">No genre data available</div>
          ) : (
            <div className="h-[280px] w-full" style={{ minWidth: 0, minHeight: 0 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genres?.distribution || []}
                        dataKey="count"
                        nameKey="genre"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={55}
                        paddingAngle={2}
                      >
                        {genres?.distribution?.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(val, name) => [Number(val ?? 0), String(name ?? "")]}
                        contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 13 }}
                      />
                      <Legend 
                        iconType="circle"
                        iconSize={8}
                        formatter={(val) => <span style={{ fontSize: 12, color: "#6B7280" }}>{val}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] w-full bg-gray-50 rounded-xl" />
                )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <h2 className="font-bold text-gray-900 mb-6">User Growth</h2>
          {userGrowthLoading ? (
            <div className="h-[280px] w-full bg-gray-50 animate-pulse rounded-xl" />
          ) : (
            <div className="h-[280px] w-full" style={{ minWidth: 0, minHeight: 0 }}>
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowth?.growth || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString("en", { month: "short" })}
                      tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      tickLine={false} 
                      axisLine={false}
                      width={45}
                      dx={-10}
                    />
                    <RechartsTooltip 
                      contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 13 }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString("en", { month: "long", year: "numeric" })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulativeUsers" 
                      stroke="#2563EB" 
                      strokeWidth={2} 
                      fill="url(#userGrowthGrad)" 
                      name="Total Users" 
                      dot={false}
                      activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] w-full bg-gray-50 rounded-xl" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-bold text-gray-900 mb-6">Top Books by Downloads</h2>
        
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="flex gap-4 text-xs text-gray-400 uppercase tracking-wide font-medium pb-3 border-b border-gray-100 px-2">
              <div className="w-6">Rank</div>
              <div className="flex-1">Book</div>
              <div className="w-28 hidden md:block">Genre</div>
              <div className="w-24 text-right">Downloads</div>
              <div className="w-20 text-right">Rating</div>
              <div className="w-20 text-right">Reviews</div>
            </div>

            {topBooksLoading ? (
              <div className="py-8 flex justify-center"><div className="animate-pulse h-8 w-8 bg-gray-200 rounded-full" /></div>
            ) : topBooks?.books?.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No books found</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topBooks?.books?.map((book, index) => (
                  <div key={book._id} className="flex items-center gap-4 py-3 hover:bg-gray-50 rounded-lg px-2 transition-colors">
                    <div className="w-6 text-sm text-gray-400 font-mono text-center">{index + 1}</div>
                    
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-10 bg-gray-100 rounded overflow-hidden relative flex-shrink-0">
                        {book.coverUrl ? (
                          <Image
                            src={book.coverUrl}
                            alt={book.title}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">No Cover</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 line-clamp-1">{book.title}</div>
                        <div className="text-xs text-gray-400 line-clamp-1">{book.author}</div>
                      </div>
                    </div>

                    <div className="w-28 text-sm text-gray-500 hidden md:block capitalize truncate">{book.genre}</div>
                    
                    <div className="w-24 text-sm font-medium text-gray-900 text-right">
                      {book.downloads.toLocaleString()}
                    </div>
                    
                    <div className="w-20 text-sm text-yellow-500 text-right">
                      ★ {book.avgRating > 0 ? book.avgRating.toFixed(1) : "—"}
                    </div>
                    
                    <div className="w-20 text-sm text-gray-400 text-right">
                      {book.totalReviews}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
