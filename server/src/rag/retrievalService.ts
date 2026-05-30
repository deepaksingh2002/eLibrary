import { cosineSimilarity } from "../embeddings/embeddingService"
import { normalizeWhitespace } from "../utils/textCleanup"

export interface StoredVectorChunk {
  chunkIndex: number
  content: string
  embedding: number[]
  chapter?: string
  page?: number
  bookName?: string
}

export interface RetrievedChunk {
  chunkIndex: number
  content: string
  score: number
  chapter?: string
  page?: number
  bookName?: string
}

export function isChapterMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeWhitespace(left).toLowerCase()
  const normalizedRight = normalizeWhitespace(right).toLowerCase()

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  )
}

export function mmrSelectChunks(params: {
  chunks: StoredVectorChunk[]
  queryVectors: number[][]
  limit: number
  lambda?: number
}): RetrievedChunk[] {
  const lambda = params.lambda ?? 0.72
  const candidates = params.chunks.map((chunk) => ({
    ...chunk,
    score: Math.max(...params.queryVectors.map((queryVector) => cosineSimilarity(chunk.embedding || [], queryVector))),
  }))

  const selected: typeof candidates = []
  const remaining = [...candidates]

  while (selected.length < params.limit && remaining.length > 0) {
    let bestIndex = 0
    let bestMmr = Number.NEGATIVE_INFINITY

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index]
      const diversityPenalty = selected.length === 0
        ? 0
        : Math.max(...selected.map((item) => cosineSimilarity(candidate.embedding || [], item.embedding || [])))
      const mmr = lambda * candidate.score - (1 - lambda) * diversityPenalty

      if (mmr > bestMmr) {
        bestMmr = mmr
        bestIndex = index
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1)
    if (chosen) selected.push(chosen)
  }

  return selected
    .sort((left, right) => left.chunkIndex - right.chunkIndex)
    .map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: normalizeWhitespace(chunk.content),
      score: chunk.score,
      chapter: chunk.chapter,
      page: chunk.page,
      bookName: chunk.bookName,
    }))
}
