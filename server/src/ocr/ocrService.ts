import sharp from "sharp"
import { recognize } from "tesseract.js"
import { cleanupOcrText } from "../utils/textCleanup"

export interface OcrPageResult {
  pageNumber: number
  text: string
}

export interface OcrPdfOptions {
  dpi?: number
  language?: string
}

export async function ocrPdfPages(
  pdfBuffer: Buffer,
  totalPages: number,
  options: OcrPdfOptions = {},
): Promise<OcrPageResult[]> {
  const dpi = options.dpi || Number(process.env.PDF_OCR_DPI || 220)
  const language = options.language || process.env.PDF_OCR_LANG || "eng"
  const pages: OcrPageResult[] = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    try {
      const imageBuffer = await sharp(pdfBuffer, { density: dpi, page: pageIndex }).png().toBuffer()
      const result = await recognize(imageBuffer, language)
      const text = cleanupOcrText(result.data?.text || "")

      if (text.length > 0) {
        pages.push({
          pageNumber: pageIndex + 1,
          text,
        })
      }
    } catch (error) {
      console.warn(
        `[OCR] Page ${pageIndex + 1} failed:`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return pages
}
