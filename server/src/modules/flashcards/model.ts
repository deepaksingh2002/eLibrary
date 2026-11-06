import mongoose, { Schema } from "mongoose"

const FlashcardDeckSchema = new Schema({
  bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  chapterId: { type: String, required: true },
  contentHash: { type: String, required: true },
  promptVersion: { type: String, required: true },
  model: { type: String, required: true },
  cards: { type: [Schema.Types.Mixed], required: true },
}, { timestamps: true })

FlashcardDeckSchema.index({ bookId: 1, chapterId: 1, contentHash: 1, promptVersion: 1 }, { unique: true })

export default mongoose.model("FlashcardDeck", FlashcardDeckSchema)
