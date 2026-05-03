import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "My Dashboard",
  robots: { index: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
