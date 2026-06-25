import { ChapterChunk, LearningPage } from "../types/aiLearning"
import { cleanupOcrText, containsPublishingNoise } from "../utils/textCleanup"
import { toSemanticParagraph } from "../utils/sentenceSegmentation"

function normalizeLineBreaks(text: string): string {
  return cleanupOcrText(text)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function isSectionHeading(line: string): boolean {
  const normalized = line.trim()
  if (!normalized || normalized.length < 4 || normalized.length > 120) return false

  if (/^(chapter|chap\.?)\s+[0-9ivxlcdm]+\b/i.test(normalized)) return true
  if (/^[0-9]+(?:\.[0-9]+)*\s+[A-Z]/.test(normalized)) return true
  if (/^[A-Z0-9][A-Z0-9\s,:;'"-]{3,}$/.test(normalized) && normalized.split(/\s+/).length <= 10) return true
  if (/^(examples?|summary|key points|exercise|review questions?|chapter summary|chapter goals)\b/i.test(normalized)) return true

  return false
}

function splitIntoSemanticBlocks(text: string): string[] {
  const blocks: string[] = []
  let currentBlock: string[] = []

  const lines = normalizeLineBreaks(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const paragraph = toSemanticParagraph(line)
    if (!paragraph) continue

    if (isSectionHeading(paragraph) && currentBlock.length > 0) {
      blocks.push(currentBlock.join(" ").trim())
      currentBlock = [paragraph]
      continue
    }

    if (paragraph.endsWith(":" ) && currentBlock.length > 0) {
      blocks.push(currentBlock.join(" ").trim())
      currentBlock = [paragraph]
      continue
    }

    currentBlock.push(paragraph)
    if (paragraph.endsWith(".") && paragraph.split(/\s+/).length > 50) {
      blocks.push(currentBlock.join(" ").trim())
      currentBlock = []
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join(" ").trim())
  }

  return blocks.filter(Boolean)
}

function packSemanticBlocks(blocks: string[], targetSize: number, maxOverlapBlocks = 1): string[] {
  const chunks: string[] = []
  let currentBlocks: string[] = []
  let currentLength = 0

  const flush = () => {
    const chunk = currentBlocks.join("\n\n").trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    if (maxOverlapBlocks > 0 && currentBlocks.length > 0) {
      currentBlocks = currentBlocks.slice(Math.max(0, currentBlocks.length - maxOverlapBlocks))
      currentLength = currentBlocks.join("\n\n").length
    } else {
      currentBlocks = []
      currentLength = 0
    }
  }

  for (const block of blocks) {
    const blockLength = block.length
    if (currentBlocks.length > 0 && currentLength + blockLength + 2 > targetSize) {
      flush()
    }

    currentBlocks.push(block)
    currentLength += blockLength + (currentBlocks.length > 1 ? 2 : 0)

    if (blockLength >= targetSize) {
      flush()
    }
  }

  const finalChunk = currentBlocks.join("\n\n").trim()
  if (finalChunk.length > 0) {
    chunks.push(finalChunk)
  }

  return chunks
}

export async function buildChapterAwareChunks(params: {
  pages: Array<LearningPage & { chapter: string; bookName: string }>
  bookName: string
  chunkSize?: number
  chunkOverlap?: number
}): Promise<ChapterChunk[]> {
  const targetSize = params.chunkSize || 700
  const maxOverlapBlocks = params.chunkOverlap && params.chunkOverlap > 0 ? 1 : 0

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

    const semanticBlocks = splitIntoSemanticBlocks(chapterText)
    const splitChunks = packSemanticBlocks(semanticBlocks.length > 0 ? semanticBlocks : [chapterText], targetSize, maxOverlapBlocks)

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
