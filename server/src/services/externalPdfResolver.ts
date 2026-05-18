import axios from "axios";

type ExternalPdfBook = {
  title: string;
  author: string;
  isbn?: string;
  importSource?: string;
  externalId?: string;
  pdfUrl?: string;
};

function pickFirst(values: unknown): string {
  if (!Array.isArray(values) || values.length === 0) return "";
  return String(values[0] || "");
}

function buildArchivePdfUrl(iaKey: string): string {
  return `https://archive.org/download/${iaKey}/${iaKey}.pdf`;
}

async function searchOpenLibraryPdf(book: ExternalPdfBook): Promise<string> {
  const queryParts = [book.title, book.author, book.isbn].filter(Boolean);
  if (queryParts.length === 0) return "";

  const query = encodeURIComponent(queryParts.join(" "));
  const url = `https://openlibrary.org/search.json?q=${query}&limit=5&fields=key,title,author_name,description,cover_i,subject,language,first_publish_year,publisher,isbn,number_of_pages_median,ia,ebook_access`;

  const response = await axios.get(url, { timeout: 8000 });
  const docs = response.data?.docs || [];

  for (const doc of docs) {
    const iaKey = Array.isArray(doc.ia) ? doc.ia[0] : doc.ia;
    const hasEbook = doc.ebook_access === "public" || doc.ebook_access === "borrowable";

    if (iaKey && hasEbook) {
      return buildArchivePdfUrl(iaKey);
    }
  }

  return "";
}

async function searchInternetArchivePdf(book: ExternalPdfBook): Promise<string> {
  try {
    if (!book.title) return "";

    // Search Internet Archive directly
    const query = encodeURIComponent(`${book.title} ${book.author || ""}`);
    const url = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier&output=json&rows=5`;

    const response = await axios.get(url, { timeout: 8000 });
    const results = response.data?.response?.docs || [];

    for (const result of results) {
      const identifier = result.identifier;
      if (identifier) {
        // Verify the PDF exists
        const pdfUrl = buildArchivePdfUrl(identifier);
        try {
          const headResponse = await axios.head(pdfUrl, { timeout: 3000 });
          if (headResponse.status === 200) {
            return pdfUrl;
          }
        } catch {
          continue;
        }
      }
    }

    return "";
  } catch (error: any) {
    return "";
  }
}

export async function resolveExternalPdfUrl(book: ExternalPdfBook): Promise<string> {
  if (book.pdfUrl) {
    return book.pdfUrl;
  }

  try {
    // Try Open Library first (fastest and most reliable)
    const olPdf = await searchOpenLibraryPdf(book);
    if (olPdf) return olPdf;

    // Then try Internet Archive directly
    const iaPdf = await searchInternetArchivePdf(book);
    if (iaPdf) return iaPdf;

    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[PdfResolver] Failed to resolve external PDF URL:", message);
    return "";
  }
}