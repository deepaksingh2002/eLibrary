"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace(user?.role === "admin" ? "/admin" : "/");
    }
  }, [hasHydrated, isAuthenticated, router, user?.role]);

  if (!hasHydrated || isAuthenticated) return null; // Avoid flicker

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
