"use client";

import React from "react";
import { useRouter } from "next/navigation";
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
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (requiredRole && user?.role !== requiredRole) {
      router.push("/");
    } else {
      setIsChecking(false);
    }
  }, [isAuthenticated, user, requiredRole, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
};
