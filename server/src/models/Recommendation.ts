import mongoose, { Document, Schema } from "mongoose";

export interface IRecommendation extends Document {
  userId: mongoose.Types.ObjectId;
  books: { bookId: mongoose.Types.ObjectId; score: number; reason: string }[];
  computedAt: Date;
  version: number;
  isColdStart: boolean;
}

const recommendationSchema = new Schema<IRecommendation>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  books: [{
    bookId: { type: Schema.Types.ObjectId, ref: "Book" },
    score: { type: Number },
    reason: { type: String }
  }],
  computedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
  isColdStart: { type: Boolean, default: false }
});

recommendationSchema.index({ userId: 1 }, { unique: true });
recommendationSchema.index({ computedAt: -1 });

const Recommendation = mongoose.model<IRecommendation>("Recommendation", recommendationSchema);

export { Recommendation };
export default Recommendation;
