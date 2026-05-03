"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { Spinner } from "../../../../components/ui/Spinner";
import { Button } from "../../../../components/ui/Button";
import { toast } from "../../../../components/ui/Toast";
import { useAuthStore } from "../../../../store/authStore";
import api from "../../../../lib/api";

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  avatar?: string;
  totalBooksRead: number;
  streak: number;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

const roleBadgeClass: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  user: "bg-blue-100 text-blue-700",
  guest: "bg-gray-100 text-gray-500",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["admin-users", page, debouncedSearch, roleFilter, sortBy],
    queryFn: () =>
      api
        .get("/api/admin/users", {
          params: { page, limit: 20, search: debouncedSearch, role: roleFilter, sort: sortBy },
        })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/api/admin/users/${id}/role`, { role }),
    onMutate: ({ id }) => setChangingRoleId(id),
    onSettled: () => setChangingRoleId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => {
      setDeletingId(null);
      setConfirmDeleteId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deactivated");
    },
    onError: () => toast.error("Failed to deactivate user"),
  });

  return (
    <ProtectedRoute requiredRole="admin">
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            {data?.total ?? 0} total users
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="guest">Guest</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="newest">Newest</option>
            <option value="active">Most Active</option>
            <option value="streak">Highest Streak</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>User</span>
            <span>Role</span>
            <span>Books Read</span>
            <span>Streak</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : !data?.users?.length ? (
              <div className="text-center py-16 text-gray-400 text-sm">No users found</div>
            ) : (
              <div>
                {data.users.map((u) => (
                  <div
                    key={u._id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                      {/* User */}
                      <div className="flex items-center gap-3 min-w-0">
                        <UserInitials name={u.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass[u.role]}`}>
                          {u.role}
                        </span>
                        <select
                          value={u.role}
                          disabled={changingRoleId === u._id || u._id === currentUser?.id}
                          onChange={(e) => changeRoleMutation.mutate({ id: u._id, role: e.target.value })}
                          className="text-xs border border-gray-200 rounded-lg px-1 py-0.5 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 cursor-pointer"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="guest">Guest</option>
                        </select>
                        {changingRoleId === u._id && (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        )}
                      </div>

                      {/* Books read */}
                      <span className="text-sm text-gray-600">{u.totalBooksRead ?? 0}</span>

                      {/* Streak */}
                      <span className={`text-sm ${u.streak > 0 ? "text-orange-500" : "text-gray-300"}`}>
                        {u.streak > 0 ? `🔥 ${u.streak}` : "—"}
                      </span>

                      {/* Joined */}
                      <span className="text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => router.push(`/admin/users/${u._id}/activity`)}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Activity
                        </button>

                        {confirmDeleteId === u._id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Sure?</span>
                            <button
                              onClick={() => deleteMutation.mutate(u._id)}
                              disabled={deletingId === u._id}
                              className="text-xs text-red-600 font-semibold hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {deletingId === u._id ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                              ) : (
                                "Yes"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            disabled={u._id === currentUser?.id}
                            onClick={() => setConfirmDeleteId(u._id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden px-4 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <UserInitials name={u.name} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass[u.role]}`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mb-3">
                        <span>{u.totalBooksRead ?? 0} books</span>
                        <span>{u.streak > 0 ? `🔥 ${u.streak} streak` : "No streak"}</span>
                        <span>
                          {new Date(u.createdAt).toLocaleDateString("en", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          disabled={changingRoleId === u._id || u._id === currentUser?.id}
                          onChange={(e) => changeRoleMutation.mutate({ id: u._id, role: e.target.value })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none disabled:opacity-40"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="guest">Guest</option>
                        </select>

                        {confirmDeleteId === u._id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Sure?</span>
                            <button onClick={() => deleteMutation.mutate(u._id)} className="text-xs text-red-600 font-semibold px-2 py-1">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 px-2 py-1">No</button>
                          </span>
                        ) : (
                          <button
                            disabled={u._id === currentUser?.id}
                            onClick={() => setConfirmDeleteId(u._id)}
                            className="text-xs text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-30"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Pagination */}
        {(data?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between mt-4 bg-white rounded-xl border border-gray-200 px-4 py-3">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-sm text-gray-500">
              Page {page} of {data?.totalPages}
            </span>
            <Button size="sm" variant="ghost" disabled={page === data?.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
