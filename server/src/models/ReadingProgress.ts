import mongoose, { Document, Schema } from "mongoose";

export interface IReadingProgress extends Document {
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  progress: number;
  status: "not-started" | "in-progress" | "completed";
  sessions: { startTime: Date; endTime: Date; minutesRead: number }[];
  bookmarks: { _id?: mongoose.Types.ObjectId; page: number; note: string; createdAt: Date }[];
  lastRead?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const readingProgressSchema = new Schema<IReadingProgress>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ["not-started", "in-progress", "completed"], default: "not-started" },
  sessions: [{
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    minutesRead: { type: Number, default: 0 }
  }],
  bookmarks: [{
    page: { type: Number, required: true },
    note: { type: String, maxlength: 500, default: "" },
    createdAt: { type: Date, default: Date.now }
  }],
  lastRead: { type: Date }
}, { timestamps: true });

readingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });
readingProgressSchema.index({ userId: 1, lastRead: -1 });
readingProgressSchema.index({ userId: 1, status: 1 });

const ReadingProgress = mongoose.model<IReadingProgress>("ReadingProgress", readingProgressSchema);

export { ReadingProgress };
export default ReadingProgress;
