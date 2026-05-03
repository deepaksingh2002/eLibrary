import { Request, Response } from "express";
import { Types } from "mongoose";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import {
  autocompleteBooks as autocompleteBooksService,
  createBook as createBookService,
  downloadBook as downloadBookService,
  getBookById as getBookByIdService,
  hardDeleteBook,
  listBooks,
  searchBooks as searchBooksService,
  summarizeBook as summarizeBookService,
  softDeleteBook,
  toggleBookStatus as toggleBookStatusService,
  updateBook as updateBookService
} from "../services/book.service";

const isValidId = (id: string) => Types.ObjectId.isValid(id);

export const getAllBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await listBooks(req.query as Record<string, string>, req.user);
  res.status(200).json(data);
});

export const searchBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await searchBooksService(req.query as Record<string, string>);
  res.status(200).json(data);
});

export const autocompleteBooks = asyncHandler(async (req: Request, res: Response) => {
  const data = await autocompleteBooksService(req.query as { q?: string });
  res.status(200).json(data);
});

export const getBookById = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await getBookByIdService(req.params.id, req.user);
  res.status(200).json(data);
});

export const createBook = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const data = await createBookService(
    req.body as Record<string, unknown>,
    req.files as Record<string, Express.Multer.File[] | undefined> | undefined,
    req.user
  );

  res.status(201).json(data);
});

export const updateBook = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await updateBookService(
    req.params.id,
    req.body as Record<string, unknown>,
    req.files as Record<string, Express.Multer.File[] | undefined> | undefined
  );

  res.status(200).json(data);
});

export const deleteBook = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await softDeleteBook(req.params.id);
  res.status(200).json(data);
});

export const permanentDeleteBook = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await hardDeleteBook(req.params.id);
  res.status(200).json(data);
});

export const toggleBookStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  const data = await toggleBookStatusService(req.params.id);
  res.status(200).json(data);
});

export const downloadBook = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  try {
    console.log(`[BookController] Download request for book: ${req.params.id} by user: ${req.user.id}`);
    const data = await downloadBookService(req.params.id, req.user);
    console.log(`[BookController] Download URL generated successfully`);
    res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BookController] Download error:`, message);
    throw error;
  }
});

export const summarizeBook = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidId(req.params.id)) {
    throw new ApiError(400, "Invalid book ID");
  }

  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const data = await summarizeBookService(req.params.id);
  res.status(200).json(data);
});
