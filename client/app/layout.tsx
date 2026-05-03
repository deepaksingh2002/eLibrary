import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers";
import { ToastContainer } from "../components/ui/Toast";

export const metadata: Metadata = {
  title: {
    default: "eLibrary — Advanced Digital Library",
    template: "%s | eLibrary",
  },
  description:
    "AI-powered digital library with 12,400+ academic books. Track reading progress, get personalized recommendations, and join a community of readers.",
  keywords: [
    "digital library",
    "academic books",
    "AI recommendations",
    "reading tracker",
    "ebooks",
    "free books",
  ],
  authors: [{ name: "eLibrary" }],
  openGraph: {
    type: "website",
    title: "eLibrary — Advanced Digital Library",
    description: "AI-powered digital library with 12,400+ academic books.",
    siteName: "eLibrary",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
