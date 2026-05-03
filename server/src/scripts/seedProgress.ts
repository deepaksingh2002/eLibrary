import dotenv from "dotenv";
import mongoose from "mongoose";
import { Book } from "../models/Book";
import { ReadingProgress } from "../models/ReadingProgress";
import { User } from "../models/User";
import { UserActivity } from "../models/UserActivity";

dotenv.config();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRecentDateWithinDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, days - 1));
  date.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);
  return date;
}

async function seedProgress() {
  const mongoUri = process.env.MONGO_URI?.trim();

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(mongoUri);

  try {
    const books = await Book.find({ isDeleted: false }).limit(3);
    const users = await User.find({ role: { $ne: "admin" }, isDeleted: false }).limit(2);

    if (books.length < 3 || users.length < 2) {
      throw new Error("Need at least 3 books and 2 non-admin users before seeding progress");
    }

    let seededCount = 0;

    for (const user of users) {
      for (const book of books) {
        const progress = randomInt(10, 90);
        const minutesRead = randomInt(10, 60);
        const endTime = randomRecentDateWithinDays(7);
        const startTime = new Date(endTime.getTime() - minutesRead * 60000);

        const progressDoc = await ReadingProgress.findOneAndUpdate(
          { userId: user._id, bookId: book._id },
          {
            $set: {
              progress,
              status: "in-progress",
              lastRead: endTime,
            },
            $push: {
              sessions: {
                startTime,
                endTime,
                minutesRead,
              },
            },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );

        await UserActivity.create({
          userId: user._id,
          bookId: book._id,
          eventType: "progress",
          metadata: { progress },
          createdAt: endTime,
        });

        if (progressDoc) seededCount += 1;
      }
    }

    console.log(`Seeded ${seededCount} progress records`);
  } finally {
    await mongoose.disconnect();
  }
}

seedProgress().catch((error) => {
  console.error("Failed to seed progress:", error);
  process.exit(1);
});
