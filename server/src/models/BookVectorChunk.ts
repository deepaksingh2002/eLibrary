import mongoose, { Document, Schema } from "mongoose"

export interface IBookVectorChunk extends Document {
  bookId: mongoose.Types.ObjectId
  chunkIndex: number
  content: string
  embedding: number[]
  chapter: string
  page: number
  bookName: string
  createdAt: Date
  updatedAt: Date
}

const BookVectorChunkSchema = new Schema<IBookVectorChunk>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    chapter: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    page: {
      type: Number,
      required: true,
      index: true,
    },
    bookName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
)

BookVectorChunkSchema.index({ bookId: 1, chunkIndex: 1 }, { unique: true })
BookVectorChunkSchema.index({ bookId: 1, createdAt: -1 })
BookVectorChunkSchema.index({ bookId: 1, chapter: 1, page: 1 })

export default mongoose.model<IBookVectorChunk>("BookVectorChunk", BookVectorChunkSchema)