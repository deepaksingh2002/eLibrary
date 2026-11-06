export interface RankedItem {
  id: string
  score?: number
  content?: string
}

export function bm25Score(query: string, document: string, documents: string[] = [document]): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const tokens = document.toLowerCase().split(/\s+/)
  const averageLength = documents.reduce((sum, item) => sum + item.split(/\s+/).length, 0) / documents.length
  const length = tokens.length
  return terms.reduce((score, term) => {
    const frequency = tokens.filter((token) => token.includes(term)).length
    if (!frequency) return score
    const documentFrequency = documents.filter((item) => item.toLowerCase().includes(term)).length
    const idf = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5))
    return score + idf * ((frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * length / averageLength)))
  }, 0)
}

export function reciprocalRankFusion(rankings: RankedItem[][], k = 60): RankedItem[] {
  const scores = new Map<string, number>()
  const values = new Map<string, RankedItem>()
  rankings.forEach((ranking) => ranking.forEach((item, index) => {
    scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + index + 1))
    values.set(item.id, item)
  }))
  return Array.from(scores.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([id, score]) => ({ ...values.get(id), id, score }))
}

export interface Reranker {
  rerank(items: RankedItem[], query: string): Promise<RankedItem[]>
}

export const noOpReranker: Reranker = {
  async rerank(items) {
    return items
  },
}
