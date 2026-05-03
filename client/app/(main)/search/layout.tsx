import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Search Books",
  description: "Search our collection of academic and educational books.",
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
