import { Router } from "express";
import { uploadBookFiles } from "../config/cloudinary";
import {
  autocompleteBooks,
  createBook,
  deleteBook,
  downloadBook,
  getAllBooks,
  getBookById,
  permanentDeleteBook,
  searchBooks,
  summarizeBook,
  toggleBookStatus,
  updateBook
} from "../controllers/book.controller";
import { protect } from "../middleware/auth.middleware";
import { optionalAuth } from "../middleware/optionalAuth.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const router = Router();

router.get("/search", optionalAuth, searchBooks);
router.get("/autocomplete", optionalAuth, autocompleteBooks);
router.get("/", optionalAuth, getAllBooks);
router.get("/:id", optionalAuth, getBookById);

router.get("/:id/summary", protect, summarizeBook);
router.post("/:id/download", protect, downloadBook);

router.post("/", protect, requireRole("admin"), uploadBookFiles, createBook);
router.patch("/:id", protect, requireRole("admin"), uploadBookFiles, updateBook);
router.delete("/:id", protect, requireRole("admin"), deleteBook);
router.delete("/:id/permanent", protect, requireRole("admin"), permanentDeleteBook);
router.patch("/:id/toggle-status", protect, requireRole("admin"), toggleBookStatus);

export default router;
