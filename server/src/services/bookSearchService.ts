import axios from "axios";

export interface ExternalBookResult {
  externalId: string;
  source: "google_books" | "open_library" | "dbooks";
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  genre: string;
  language: string;
  pageCount: number;
  publishedYear: string;
  publisher: string;
  isbn: string;
  pdfUrl: string;
  previewUrl: string;
  tags: string[];
}

function cleanCoverUrl(url: string): string {
  return url
    .replace("http://", "https://")
    .replace("&edge=curl", "")
    .replace("zoom=1", "zoom=3");
}

function pickFirst(values: unknown): string {
  return Array.isArray(values) && values.length > 0
    ? String(values[0] || "")
    : "";
}

function normalizeIsbn(
  identifiers: Array<{ type?: string; identifier?: string }>,
): string {
  const isbn13 =
    identifiers.find((item) => item.type === "ISBN_13")?.identifier || "";
  const isbn10 =
    identifiers.find((item) => item.type === "ISBN_10")?.identifier || "";
  return isbn13 || isbn10 || "";
}

async function resolvePdfFromOpenLibrary(book: {
  isbn?: string;
  title: string;
  author: string;
}): Promise<string> {
  try {
    if (!book.title || !book.author) return "";

    const queryParts = [book.title, book.author];
    if (book.isbn) queryParts.unshift(book.isbn);

    const query = encodeURIComponent(queryParts.join(" "));
    const url = `https://openlibrary.org/search.json?q=${query}&limit=3&fields=ia,ebook_access`;

    const response = await axios.get(url, { timeout: 5000 });
    const docs = response.data?.docs || [];

    for (const doc of docs) {
      const iaKey = Array.isArray(doc.ia) ? doc.ia[0] : doc.ia;
      const hasEbook =
        doc.ebook_access === "public" || doc.ebook_access === "borrowable";

      if (iaKey && hasEbook) {
        return `https://archive.org/download/${iaKey}/${iaKey}.pdf`;
      }
    }

    return "";
  } catch (error: any) {
    return "";
  }
}

async function searchGoogleBooks(
  query: string,
  limit = 10,
): Promise<ExternalBookResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=${limit}&printType=books`;
    const response = await axios.get(url, { timeout: 5000 });
    const items = response.data?.items || [];

    return items.map((item: Record<string, unknown>) => {
      const info = (item.volumeInfo || {}) as Record<string, unknown>;
      const images = (info.imageLinks || {}) as Record<string, string>;
      const coverUrl =
        images.extraLarge ||
        images.large ||
        images.medium ||
        images.thumbnail ||
        images.smallThumbnail ||
        "";
      const identifiers = (info.industryIdentifiers || []) as Array<{
        type?: string;
        identifier?: string;
      }>;
      const categories = (info.categories || []) as string[];

      return {
        externalId: item.id || "",
        source: "google_books" as const,
        title: String(info.title || "Unknown Title"),
        author: Array.isArray(info.authors)
          ? (info.authors as string[]).join(", ") || "Unknown Author"
          : "Unknown Author",
        description: String(info.description || ""),
        coverUrl: coverUrl ? cleanCoverUrl(coverUrl) : "",
        genre: categories[0] || "",
        language: String(info.language || "en"),
        pageCount: Number(info.pageCount || 0),
        publishedYear: String(info.publishedDate || "").slice(0, 4),
        publisher: String(info.publisher || ""),
        isbn: normalizeIsbn(identifiers),
        pdfUrl: "",
        previewUrl: String(info.previewLink || ""),
        tags: categories.slice(0, 5),
      };
    });
  } catch {
    return [];
  }
}

async function searchOpenLibrary(
  query: string,
  limit = 10,
): Promise<ExternalBookResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://openlibrary.org/search.json?q=${encoded}&limit=${limit}&fields=key,title,author_name,description,cover_i,subject,language,first_publish_year,publisher,isbn,number_of_pages_median,ia,ebook_access`;
    const response = await axios.get(url, { timeout: 5000 });
    const docs = response.data?.docs || [];

    return docs.map((doc: Record<string, unknown>) => {
      const coverUrl = doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : "";
      const iaArray = Array.isArray(doc.ia) ? doc.ia : doc.ia ? [doc.ia] : [];
      const iaKey = iaArray.length > 0 ? String(iaArray[0]) : "";
      const hasEbook =
        doc.ebook_access === "public" || doc.ebook_access === "borrowable";
      const pdfUrl =
        iaKey && hasEbook
          ? `https://archive.org/download/${iaKey}/${iaKey}.pdf`
          : "";
      const authors = (doc.author_name || []) as string[];
      const isbn = pickFirst(doc.isbn);
      const subjects = (doc.subject || []) as string[];
      const language = pickFirst(doc.language) || "en";
      const rawDescription =
        typeof doc.description === "string"
          ? doc.description
          : (doc.description as Record<string, unknown>)?.value || "";

      return {
        externalId: String(doc.key || "").replace("/works/", ""),
        source: "open_library" as const,
        title: String(doc.title || "Unknown Title"),
        author: authors.slice(0, 3).join(", ") || "Unknown Author",
        description: rawDescription,
        coverUrl,
        genre: subjects[0] || "",
        language: language === "eng" ? "en" : language,
        pageCount: Number(doc.number_of_pages_median || 0),
        publishedYear: String(doc.first_publish_year || ""),
        publisher: pickFirst(doc.publisher),
        isbn,
        pdfUrl,
        previewUrl: doc.key ? `https://openlibrary.org${doc.key}` : "",
        tags: subjects.slice(0, 5),
      };
    });
  } catch {
    return [];
  }
}

async function searchDbooks(
  query: string,
  limit = 10,
): Promise<ExternalBookResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://www.dbooks.org/api/search/${encoded}`;
    const response = await axios.get(url, { timeout: 5000 });

    if (
      response.data?.status !== "ok" ||
      !Array.isArray(response.data?.books)
    ) {
      return [];
    }

    const books = response.data.books.slice(0, limit);

    const detailedBooksPromises = books.map(async (book: any) => {
      try {
        const detailResponse = await axios.get(
          `https://www.dbooks.org/api/book/${book.id}`,
          { timeout: 5000 },
        );
        const detail = detailResponse.data;

        if (detail.status !== "ok") return null;

        return {
          externalId: String(detail.id),
          source: "dbooks" as const,
          title: String(detail.title || "Unknown Title"),
          author: String(detail.authors || "Unknown Author"),
          description: String(detail.description || ""),
          coverUrl: detail.image ? String(detail.image) : "",
          genre: "Technology",
          language: "en",
          pageCount: parseInt(detail.pages) || 0,
          publishedYear: String(detail.year || ""),
          publisher: String(detail.publisher || ""),
          isbn: String(detail.id),
          pdfUrl: detail.download ? String(detail.download) : "",
          previewUrl: detail.url ? String(detail.url) : "",
          tags: ["Programming", "IT"],
        } as ExternalBookResult;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(detailedBooksPromises);
    return results.filter(Boolean) as ExternalBookResult[];
  } catch {
    return [];
  }
}

export async function searchBooksOnline(
  query: string,
  limit = 12,
): Promise<ExternalBookResult[]> {
  const [googleResults, openLibraryResults, dbooksResults] =
    await Promise.allSettled([
      searchGoogleBooks(query, limit),
      searchOpenLibrary(query, limit),
      searchDbooks(query, limit),
    ]);

  const google =
    googleResults.status === "fulfilled" ? googleResults.value : [];
  const openLibrary =
    openLibraryResults.status === "fulfilled" ? openLibraryResults.value : [];
  const dbooks =
    dbooksResults.status === "fulfilled" ? dbooksResults.value : [];

  // Mix them: try to get dbooks first since they have PDFs!
  const combined = [...dbooks, ...google, ...openLibrary];
  const seen = new Set<string>();

  return combined
    .filter((book) => {
      const key = book.isbn
        ? `isbn:${book.isbn}`
        : `title:${book.title.toLowerCase().slice(0, 30)}:${book.author.toLowerCase().slice(0, 20)}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function getGoogleBookById(
  googleId: string,
): Promise<ExternalBookResult | null> {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/books/v1/volumes/${googleId}`,
      { timeout: 5000 },
    );
    const item = response.data as Record<string, unknown>;

    if (!item) return null;

    const info = (item.volumeInfo || {}) as Record<string, unknown>;
    const images = (info.imageLinks || {}) as Record<string, string>;
    const coverUrl = cleanCoverUrl(
      images.extraLarge ||
        images.large ||
        images.medium ||
        images.thumbnail ||
        "",
    );
    const identifiers = (info.industryIdentifiers || []) as Array<{
      type?: string;
      identifier?: string;
    }>;
    const isbn = normalizeIsbn(identifiers);
    const categories = (info.categories || []) as string[];
    const authors = (info.authors || []) as string[];

    const pdfUrl = await resolvePdfFromOpenLibrary({
      title: String(info.title || ""),
      author: authors[0] || "",
      isbn,
    });

    return {
      externalId: String(item.id || ""),
      source: "google_books" as const,
      title: String(info.title || ""),
      author: authors.join(", "),
      description: String(info.description || ""),
      coverUrl,
      genre: categories[0] || "",
      language: String(info.language || "en"),
      pageCount: Number(info.pageCount || 0),
      publishedYear: String(info.publishedDate || "").slice(0, 4),
      publisher: String(info.publisher || ""),
      isbn,
      pdfUrl: pdfUrl || "",
      previewUrl: String(info.previewLink || ""),
      tags: categories.slice(0, 5),
    };
  } catch {
    return null;
  }
}
