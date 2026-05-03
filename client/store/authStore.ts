"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  updateToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),
      logout: () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
        // Use plain axios to avoid circular dependency with api.ts
        axios
          .post(
            `${API_URL}/api/auth/logout`,
            {},
            { withCredentials: true }
          )
          .catch(() => {});
      },
      updateToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: "elibrary-auth",
      // Only persist user — accessToken stays in memory only (never persisted)
      partialize: (state) => ({ user: state.user }),
      // Rehydrate: derive isAuthenticated from the stored user value
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.user;
          state.accessToken = null; // always reset on boot
        }
      },
    }
  )
);
