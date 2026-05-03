import type { Metadata } from "next";
import React from "react";
import { AdminNav } from "../../../components/AdminNav";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
