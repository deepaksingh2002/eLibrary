"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { Button } from "../../../../components/ui/Button";
import { toast } from "../../../../components/ui/Toast";
import {
  useGetAdminUsersQuery,
  useUpdateAdminUserRoleMutation,
  useDeleteAdminUserMutation,
} from "../../../../store/services/api";

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

const roleOptions = ["user", "admin", "guest"];

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error, refetch } = useGetAdminUsersQuery({
    page,
    search: debouncedSearch,
    role: roleFilter || undefined,
    sort: sortBy,
  });

  const [updateRole] = useUpdateAdminUserRoleMutation();
  const [deleteUser, { isLoading: isDeletingUser }] =
    useDeleteAdminUserMutation();

  const handleChangeRole = async (userId: string, newRole: string) => {
    setChangingRoleId(userId);
    try {
      await updateRole({ id: userId, role: newRole }).unwrap();
      toast.success("User role updated");
      refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update role";
      toast.error(message);
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      await deleteUser(userId).unwrap();
      toast.success("User deactivated");
      setConfirmDeleteId(null);
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const users: AdminUser[] = data?.users || [];
  const totalPages = data?.totalPages || 1;

  const buildPageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 1) return [1];
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      if (i > 1 && i < totalPages) pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6 px-4 py-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data?.total || 0} total users
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
              <p className="text-sm text-gray-500">Loading users...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600 font-medium mb-4">Failed to load users</p>
            <Button onClick={() => refetch()} className="bg-red-600 hover:bg-red-700">
              Retry
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20h12a6 6 0 00-6-6 6 6 0 00-6 6z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900">No users found</p>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Books Read
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Streak
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((user) => (
                      <tr
                        key={user._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.avatar ? (
                              <Image
                                src={user.avatar}
                                alt={user.name}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <UserInitials name={user.name} />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleChangeRole(user._id, e.target.value)
                            }
                            disabled={changingRoleId === user._id}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                              roleBadgeClass[user.role]
                            } border-0 cursor-pointer disabled:opacity-50`}
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {user.totalBooksRead}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {user.streak} days
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setConfirmDeleteId(user._id)}
                            disabled={deletingId === user._id}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 hover:underline"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-4 md:hidden">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="rounded-xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <Image
                          src={user.avatar}
                          alt={user.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <UserInitials name={user.name} />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteId(user._id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Role</span>
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleChangeRole(user._id, e.target.value)
                        }
                        disabled={changingRoleId === user._id}
                        className={`rounded-lg px-2 py-1 text-xs font-medium ${
                          roleBadgeClass[user.role]
                        } border-0 cursor-pointer disabled:opacity-50`}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Books Read</span>
                      <span className="font-medium text-gray-900">
                        {user.totalBooksRead}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Streak</span>
                      <span className="font-medium text-gray-900">
                        {user.streak} days
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {pageNumbers.map((num, idx) => (
                  <React.Fragment key={num}>
                    {idx > 0 && pageNumbers[idx - 1] !== num - 1 && (
                      <span className="text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setPage(num)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        page === num
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {num}
                    </button>
                  </React.Fragment>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-2xl bg-white p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Confirm Deactivation
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to deactivate this user? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    confirmDeleteId && handleDeleteUser(confirmDeleteId)
                  }
                  disabled={isDeletingUser}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingUser ? "Deactivating..." : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
