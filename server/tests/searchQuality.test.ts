/// <reference types="jest" />

import { bm25Score, noOpReranker, reciprocalRankFusion } from "../src/rag/searchQuality"

test("RRF favors items ranked highly by both sources", () => {
  const result = reciprocalRankFusion([
    [{ id: "exact" }, { id: "other" }],
    [{ id: "exact" }, { id: "third" }],
  ])
  expect(result[0]?.id).toBe("exact")
})

test("BM25 ranks exact phrase content higher", () => {
  expect(bm25Score("adaptive threshold", "adaptive threshold preserves faint scans"))
    .toBeGreaterThan(bm25Score("adaptive threshold", "unrelated rendering details"))
})

test("no-op reranker preserves order", async () => {
  const items = [{ id: "a" }, { id: "b" }]
  await expect(noOpReranker.rerank(items, "query")).resolves.toEqual(items)
})
