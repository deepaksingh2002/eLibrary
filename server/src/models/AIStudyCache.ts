import mongoose, { Schema, Document } from "mongoose"
import {
  BookSummary,
  MCQQuestion,
  KeyPoints
} from "../services/aiStudyService"

export interface IAIStudyCache extends Document {
  bookId: mongoose.Types.ObjectId
  summary: BookSummary | null
  mcq: MCQQuestion[] | null
  keyPoints: KeyPoints | null
  generatedAt: Date
  expiresAt: Date
}

const AIStudyCacheSchema = new Schema<IAIStudyCache>({
  bookId: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: true,
    unique: true
  },
  summary: { type: Schema.Types.Mixed, default: null },
  mcq: { type: Schema.Types.Mixed, default: null },
  keyPoints: { type: Schema.Types.Mixed, default: null },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
})

AIStudyCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
AIStudyCacheSchema.index({ bookId: 1 })

export default mongoose.model<IAIStudyCache>("AIStudyCache", AIStudyCacheSchema)
