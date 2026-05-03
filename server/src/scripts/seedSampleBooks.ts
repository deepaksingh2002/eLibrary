import dotenv from "dotenv";
import mongoose from "mongoose";
import { Book } from "../models/Book";

dotenv.config();

const sampleBooks = [
  {
    title: "Practical Node.js Patterns",
    author: "Aarav Mehta",
    description:
      "A hands-on guide to building production-ready Node.js services, covering architecture, observability, queues, and deployment workflows.",
    genre: "Programming",
    language: "en",
    tags: ["nodejs", "backend", "typescript"],
    pdfUrl: "https://example.com/books/practical-nodejs-patterns.pdf",
    pdfPublicId: "samples/practical-nodejs-patterns",
    status: "published" as const,
    downloads: 184,
    avgRating: 4.6,
    totalReviews: 12,
  },
  {
    title: "Linear Algebra for Engineers",
    author: "Priya Raman",
    description:
      "Covers vectors, matrices, eigenvalues, and practical engineering applications with worked examples and clear intuition.",
    genre: "Mathematics",
    language: "en",
    tags: ["algebra", "engineering", "math"],
    pdfUrl: "https://example.com/books/linear-algebra-for-engineers.pdf",
    pdfPublicId: "samples/linear-algebra-for-engineers",
    status: "published" as const,
    downloads: 126,
    avgRating: 4.3,
    totalReviews: 8,
  },
  {
    title: "Foundations of Data Science",
    author: "Sofia Alvarez",
    description:
      "Introduces probability, statistics, machine learning foundations, and data storytelling for students entering data science.",
    genre: "Science",
    language: "en",
    tags: ["data-science", "statistics", "machine-learning"],
    pdfUrl: "https://example.com/books/foundations-of-data-science.pdf",
    pdfPublicId: "samples/foundations-of-data-science",
    status: "published" as const,
    downloads: 231,
    avgRating: 4.8,
    totalReviews: 19,
  },
  {
    title: "Business Strategy Essentials",
    author: "Neha Kapoor",
    description:
      "A concise introduction to competitive strategy, market positioning, and decision-making for students and founders.",
    genre: "Business",
    language: "en",
    tags: ["strategy", "business", "leadership"],
    pdfUrl: "https://example.com/books/business-strategy-essentials.pdf",
    pdfPublicId: "samples/business-strategy-essentials",
    status: "published" as const,
    downloads: 94,
    avgRating: 4.1,
    totalReviews: 5,
  },
];

async function seedSampleBooks() {
  const mongoUri = process.env.MONGO_URI?.trim();

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(mongoUri);

  try {
    const operations = sampleBooks.map((book) => ({
      updateOne: {
        filter: { title: book.title, author: book.author },
        update: { $setOnInsert: { ...book, isDeleted: false } },
        upsert: true,
      },
    }));

    const result = await Book.bulkWrite(operations);
    const totalPublishedBooks = await Book.countDocuments({ status: "published", isDeleted: false });

    console.log("Sample books seeded.");
    console.log(`Inserted: ${result.upsertedCount}`);
    console.log(`Matched existing: ${result.matchedCount}`);
    console.log(`Total published books: ${totalPublishedBooks}`);
  } finally {
    await mongoose.disconnect();
  }
}

seedSampleBooks().catch((error) => {
  console.error("Failed to seed sample books:", error);
  process.exit(1);
});
