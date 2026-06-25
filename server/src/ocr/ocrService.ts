import sharp from "sharp"
import { createWorker } from "tesseract.js"
import { cleanupOcrText } from "../utils/textCleanup"

export interface OcrPageResult {
  pageNumber: number
  text: string
}

export interface OcrPdfOptions {
  dpi?: number
  language?: string
  // whether to run a light binarization step
  binarize?: boolean
}

async function preprocessImage(buffer: Buffer, dpi: number, binarize = true): Promise<Buffer> {
  let img = sharp(buffer, { density: dpi, pages: 1 })
    .greyscale()
    .normalize()
    .flatten({ background: "white" })
    .png()

  if (binarize) {
    // adaptive-ish threshold by resizing then restoring helps OCR on noisy scans
    img = img
      .resize({ width: 1800, withoutEnlargement: true })
      .threshold(160)
  }

  return img.toBuffer()
}

export async function ocrPdfPages(
  pdfBuffer: Buffer,
  totalPages: number,
  options: OcrPdfOptions = {},
): Promise<OcrPageResult[]> {
  const dpi = options.dpi || Number(process.env.PDF_OCR_DPI || 220)
  const language = options.language || process.env.PDF_OCR_LANG || "eng"
  const binarize = options.binarize !== false

  const worker = await createWorker(language)

  try {

    const pages: OcrPageResult[] = []

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      try {
        const imageBuffer = await preprocessImage(
          await sharp(pdfBuffer, { density: dpi, page: pageIndex }).png().toBuffer(),
          dpi,
          binarize,
        )

        const { data } = await worker.recognize(imageBuffer)
        const text = cleanupOcrText(data?.text || "")

        if (text && text.length > 0) {
          pages.push({ pageNumber: pageIndex + 1, text })
        }
      } catch (err) {
        console.warn(`[OCR] page ${pageIndex + 1} failed:`, err instanceof Error ? err.message : String(err))
      }
    }

    return pages
  } finally {
    try {
      await worker.terminate()
    } catch {}
  }
}
