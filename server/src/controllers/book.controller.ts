import { Request, Response } from "express";
import { Types } from "mongoose";
import axios from "axios";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import {
  autocompleteBooks as autocompleteBooksService,
  createBook as createBookService,
  downloadBook as downloadBookService,
  getBookById as getBookByIdService,
  hardDeleteBook,
  listBooks,
  resolveBookPdf as resolveBookPdfService,
  searchBooks as searchBooksService,
  summarizeBook as summarizeBookService,
  softDeleteBook,
  toggleBookStatus as toggleBookStatusService,
  updateBook as updateBookService,
} from "../services/book.service";

const isValidId = (id: string) => Types.ObjectId.isValid(id);
const getParamValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

export const getAllBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await listBooks(req.query as Record<string, string>, req.user);
  res.status(200).json(data);
});

export const searchBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await searchBooksService(req.query as Record<string, string>);
  res.status(200).json(data);
});

export const autocompleteBooks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await autocompleteBooksService(req.query as { q?: string });
    res.status(200).json(data);
  },
);

export const getBookById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id || !isValidId(id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await getBookByIdService(id, req.user);
  res.status(200).json(data);
});

export const createBook = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const data = await createBookService(
    req.body as Record<string, unknown>,
    req.files as Record<string, Express.Multer.File[] | undefined> | undefined,
    req.user,
  );

  res.status(201).json(data);
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id || !isValidId(id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await updateBookService(
    id,
    req.body as Record<string, unknown>,
    req.files as Record<string, Express.Multer.File[] | undefined> | undefined,
  );

  res.status(200).json(data);
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id || !isValidId(id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await softDeleteBook(id);
  res.status(200).json(data);
});

export const permanentDeleteBook = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const data = await hardDeleteBook(id);
    res.status(200).json(data);
  },
);

export const toggleBookStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const data = await toggleBookStatusService(id);
    res.status(200).json(data);
  },
);

export const resolveBookPdf = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    const data = await resolveBookPdfService(id);
    res.status(200).json(data);
  },
);

export const downloadBook = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    try {
      console.log(
        `[BookController] Download request for book: ${id} by user: ${req.user.id}`,
      );
      const data = await downloadBookService(id, req.user);
      console.log(
        `[BookController] Download URL returned for book ${id}:`,
        data?.downloadUrl ? data.downloadUrl.slice(0, 200) : data?.downloadUrl,
      );
      console.log(`[BookController] Download URL generated successfully`);
      res.status(200).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BookController] Download error:`, message);
      throw error;
    }
  },
);

export const streamBookPdf = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const data = await downloadBookService(id, req.user);

    if (!data.downloadUrl) {
      throw new ApiError(404, "PDF not available for this book");
    }

    try {
      const pdfResponse = await axios.get(data.downloadUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent": "eLibrary-Server/1.0",
        },
      });

      const rawContentType = pdfResponse.headers["content-type"];
      const contentType =
        typeof rawContentType === "string"
          ? rawContentType
          : "application/pdf";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${data.fileName || `book-${id}.pdf`}"`,
      );
      res.setHeader("Cache-Control", "no-store, private");
      res.status(200).send(Buffer.from(pdfResponse.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[BookController] PDF stream error for ${id}:`, message);
      throw new ApiError(502, "Failed to load PDF for reading");
    }
  },
);

export const summarizeBook = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamValue(req.params.id);
    if (!id || !isValidId(id)) {
      throw new ApiError(400, "Invalid book ID");
    }

    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const data = await summarizeBookService(id);
    res.status(200).json(data);
  },
);
