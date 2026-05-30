import dotenv from "dotenv";
import mongoose from "mongoose";
import Book from "../models/Book";

dotenv.config();

async function printOne() {
  const mongoUri = process.env.MONGO_URI?.trim();
  if (!mongoUri) throw new Error("MONGO_URI missing");
  await mongoose.connect(mongoUri);
  try {
    const book = await Book.findOne({ status: "published", isDeleted: false }).lean();
    if (!book) {
      console.error("No published book found");
      process.exit(1);
    }
    console.log(String(book._id));
  } finally {
    await mongoose.disconnect();
  }
}

printOne().catch((err) => {
  console.error(err);
  process.exit(1);
});
