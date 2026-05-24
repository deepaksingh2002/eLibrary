import mongoose, { Schema, Document } from "mongoose"

export interface IAIStudyCache extends Document {
  bookId: mongoose.Types.ObjectId
  type: "summary" | "mcq" | "keypoints"
  data: any
  createdAt: Date
  expiresAt: Date
}

const AIStudyCacheSchema = new Schema<IAIStudyCache>({
  bookId: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: true,
  },
  type: {
    type: String,
    enum: ["summary", "mcq", "keypoints"],
    required: true,
  },
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
  },
})

AIStudyCacheSchema.index({ bookId: 1, type: 1 }, { unique: true })
AIStudyCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IAIStudyCache>("AIStudyCache", AIStudyCacheSchema)
