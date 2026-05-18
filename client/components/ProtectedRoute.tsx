"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { Spinner } from "./ui/Spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "user"; // spec: only admin | user (not guest)
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      const search = searchParams.toString();
      const returnUrl = search ? `${pathname}?${search}` : pathname;
      router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    } else if (requiredRole && user?.role !== requiredRole) {
      router.replace("/");
    } else {
      setIsChecking(false);
    }
  }, [hasHydrated, isAuthenticated, pathname, requiredRole, router, searchParams, user?.role]);

  if (!hasHydrated || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
};
