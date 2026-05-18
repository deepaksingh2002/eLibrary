import mongoose, { Document, Schema } from "mongoose";

export interface IBook extends Document {
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string[];
  coverUrl: string;
  coverPublicId: string;
  pdfUrl: string;
  pdfPublicId: string;
  status: "draft" | "published";
  downloads: number;
  avgRating: number;
  totalReviews: number;
  isbn: string;
  publishedYear: string;
  publisher: string;
  pageCount: number;
  importSource: "manual" | "google_books" | "open_library" | "smart_import" | "bulk_json";
  externalId: string;
  uploadedBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const bookSchema = new Schema<IBook>({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 2000, default: "" },
  genre: { type: String, required: true, trim: true },
  language: { type: String, default: "en" },
  tags: { type: [{ type: String }], default: [] },
  coverUrl: { type: String, default: "" },
  coverPublicId: { type: String, default: "" },
  pdfUrl: { type: String, default: "" },
  pdfPublicId: { type: String, default: "" },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  downloads: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  isbn: { type: String, default: "" },
  publishedYear: { type: String, default: "" },
  publisher: { type: String, default: "" },
  pageCount: { type: Number, default: 0 },
  importSource: {
    type: String,
    enum: ["manual", "google_books", "open_library", "smart_import", "bulk_json"],
    default: "manual"
  },
  externalId: { type: String, default: "" },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// --- Text Search Index (with weights for relevance scoring) ---
bookSchema.index(
  { title: "text", author: "text", description: "text" },
  { weights: { title: 10, author: 5, description: 1 }, name: "book_text_search" }
);

// --- Standard performance indexes ---
bookSchema.index({ genre: 1 });
bookSchema.index({ language: 1 });
bookSchema.index({ downloads: -1 });
bookSchema.index({ avgRating: -1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ isDeleted: 1 });
bookSchema.index({ status: 1, isDeleted: 1 });
bookSchema.index({ uploadedBy: 1 });
bookSchema.index({ isbn: 1 }, { sparse: true });

export const Book = mongoose.model<IBook>("Book", bookSchema);
export default Book;
