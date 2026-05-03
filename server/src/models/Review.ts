import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  bookId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  title: string;
  body: string;
  helpfulVotes: number;
  voters: mongoose.Types.ObjectId[];
  isFlagged: boolean;
  isRemoved: boolean;
}

const reviewSchema = new Schema<IReview>({
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, maxlength: 120 },
  body: { type: String, maxlength: 2000 },
  helpfulVotes: { type: Number, default: 0 },
  voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
  isFlagged: { type: Boolean, default: false },
  isRemoved: { type: Boolean, default: false },
}, { timestamps: true });

reviewSchema.index({ bookId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ bookId: 1, isRemoved: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ isFlagged: 1, isRemoved: 1 });
reviewSchema.index({ helpfulVotes: -1 });

export const Review = mongoose.model<IReview>("Review", reviewSchema);
