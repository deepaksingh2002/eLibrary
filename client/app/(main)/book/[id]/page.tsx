import type { Metadata } from "next";
import BookDetailClient from "./_BookDetailClient";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  try {
    const res = await fetch(
      `${API_URL}/api/books/${params.id}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();
    const book = data?.book;
    return {
      title: book ? `${book.title} by ${book.author}` : "Book Details",
      description: book?.description?.slice(0, 160) || "",
      openGraph: {
        title: book?.title || "Book Details",
        description: book?.description?.slice(0, 160) || "",
        images: book?.coverUrl ? [{ url: book.coverUrl }] : [],
      },
    };
  } catch {
    return { title: "Book Details" };
  }
}

export default function BookDetailPage() {
  return <BookDetailClient />;
}
