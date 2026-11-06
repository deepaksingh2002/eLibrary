import mongoose, { Schema, Document } from "mongoose"

export interface IAIStudyCache extends Document {
  bookId: mongoose.Types.ObjectId
  type: "summary" | "mcq" | "keypoints"
  data: any
  cacheVersion?: string
  createdAt: Date
  expiresAt?: Date
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
  cacheVersion: { type: String, default: "v1" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
})

AIStudyCacheSchema.index({ bookId: 1, type: 1 }, { unique: true })
AIStudyCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IAIStudyCache>("AIStudyCache", AIStudyCacheSchema)
