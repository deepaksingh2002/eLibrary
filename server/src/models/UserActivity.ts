import mongoose, { Document, Schema } from "mongoose";

export interface IUserActivity extends Document {
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  eventType: "view" | "download" | "rate" | "bookmark" | "complete" | "progress";
  rating?: number;
  createdAt: Date;
}

const userActivitySchema = new Schema<IUserActivity>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  eventType: { type: String, enum: ["view", "download", "rate", "bookmark", "complete", "progress"], required: true },
  rating: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

userActivitySchema.index({ userId: 1, createdAt: -1 });
userActivitySchema.index({ bookId: 1 });
userActivitySchema.index({ userId: 1, eventType: 1 });

export const UserActivity = mongoose.model<IUserActivity>("UserActivity", userActivitySchema);
