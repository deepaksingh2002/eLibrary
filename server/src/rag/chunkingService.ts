import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { ChapterChunk, LearningPage } from "../types/aiLearning"
import { cleanupOcrText, containsPublishingNoise } from "../utils/textCleanup"
import { toSemanticParagraph } from "../utils/sentenceSegmentation"

export async function buildChapterAwareChunks(params: {
  pages: Array<LearningPage & { chapter: string; bookName: string }>
  bookName: string
  chunkSize?: number
  chunkOverlap?: number
}): Promise<ChapterChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: params.chunkSize || 700,
    chunkOverlap: params.chunkOverlap || 100,
  })

  const grouped = new Map<string, Array<LearningPage & { chapter: string; bookName: string }>>()
  for (const page of params.pages) {
    const chapter = page.chapter || "Uncategorized"
    grouped.set(chapter, [...(grouped.get(chapter) || []), page])
  }

  const chunks: ChapterChunk[] = []
  for (const [chapter, pages] of grouped.entries()) {
    const chapterText = pages
      .map((page) => toSemanticParagraph(page.text))
      .filter(Boolean)
      .join("\n\n")

    if (!chapterText || containsPublishingNoise(chapterText)) continue

    const splitChunks = await splitter.splitText(chapterText)
    for (const chunkText of splitChunks) {
      const content = cleanupOcrText(chunkText)
      if (content.length < 120 || containsPublishingNoise(content)) continue

      chunks.push({
        chunkIndex: chunks.length,
        content,
        chapter,
        page: pages[0]?.pageNumber || 1,
        bookName: params.bookName,
      })
    }
  }

  return chunks
}
