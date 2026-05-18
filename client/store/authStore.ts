"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";
import { getApiBaseUrl } from "../lib/apiBaseUrl";

const API_URL = getApiBaseUrl();

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  updateToken: (accessToken: string) => void;
  finishHydration: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, hasHydrated: true }),
      logout: () => {
        set({ user: null, accessToken: null, isAuthenticated: false, hasHydrated: true });
        fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      },
      updateToken: (accessToken) => set({ accessToken, isAuthenticated: true }),
      finishHydration: () =>
        set((state) => ({
          isAuthenticated: !!state.user && !!state.accessToken,
          hasHydrated: true,
        })),
    }),
    {
      name: "elibrary-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.finishHydration();
      },
    }
  )
);
