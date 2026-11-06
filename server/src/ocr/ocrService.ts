import fs from "fs"
import path from "path"
import sharp from "sharp"
import { createWorker } from "tesseract.js"
import { cleanupOcrText } from "../utils/textCleanup"

export interface OcrPageResult {
  pageNumber: number
  text: string
  source: "ocr"
  quality: number
}

export interface OcrPageResults extends Array<OcrPageResult> {
  failedPages: number[]
  warnings: string[]
}

export interface OcrPdfOptions {
  dpi?: number
  language?: string
  binarize?: boolean
  pageNumbers?: number[]
  concurrency?: number
  timeoutMs?: number
}

type MuPdf = typeof import("mupdf")

let muPdfPromise: Promise<MuPdf> | undefined

function loadMuPdf(): Promise<MuPdf> {
  muPdfPromise ??= new Function("return import('mupdf')")() as Promise<MuPdf>
  return muPdfPromise
}

export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const mupdf = await loadMuPdf()
  const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf")
  try {
    return document.countPages()
  } finally {
    document.destroy()
  }
}

export async function rasterizePdfPage(
  pdfBuffer: Buffer,
  pageNumber: number,
  dpi = Number(process.env.PDF_OCR_DPI || 250),
): Promise<Buffer> {
  if (pageNumber < 1) {
    throw new Error(`Invalid PDF page number: ${pageNumber}`)
  }

  const mupdf = await loadMuPdf()
  const document = mupdf.Document.openDocument(pdfBuffer, "application/pdf")
  try {
    if (pageNumber > document.countPages()) {
      throw new Error(`PDF page ${pageNumber} is outside the document`)
    }

    const page = document.loadPage(pageNumber - 1)
    const bounds = page.getBounds()
    const scale = dpi / 72
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
    )
    pixmap.setResolution(dpi, dpi)
    const png = Buffer.from(pixmap.asPNG())
    page.destroy()
    return png
  } finally {
    document.destroy()
  }
}

async function preprocessImage(
  buffer: Buffer,
  binarize: boolean,
): Promise<Buffer> {
  let image = sharp(buffer).greyscale().normalize().flatten({ background: "white" })
  if (binarize) {
    image = image.threshold(Number(process.env.PDF_OCR_THRESHOLD || 0))
  }
  return image.png().toBuffer()
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, pageNumber: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`OCR timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  }).catch((error): never => {
    throw new Error(`Page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`)
  }) as Promise<T>
}

async function recognizePage(
  worker: Awaited<ReturnType<typeof createWorker>>,
  pdfBuffer: Buffer,
  pageNumber: number,
  options: Required<Pick<OcrPdfOptions, "dpi" | "binarize" | "timeoutMs">>,
): Promise<OcrPageResult> {
  const image = await preprocessImage(
    await rasterizePdfPage(pdfBuffer, pageNumber, options.dpi),
    options.binarize,
  )
  const result = await withTimeout(worker.recognize(image), options.timeoutMs, pageNumber)
  const text = cleanupOcrText(result.data?.text || "")
  return {
    pageNumber,
    text,
    source: "ocr",
    quality: text ? Math.min(1, text.split(/\s+/).filter(Boolean).length / 40) : 0,
  }
}

export async function ocrPdfPages(
  pdfBuffer: Buffer,
  totalPages: number,
  options: OcrPdfOptions = {},
): Promise<OcrPageResults> {
  const dpi = options.dpi ?? Number(process.env.PDF_OCR_DPI || 250)
  const language = options.language || process.env.PDF_OCR_LANG || "eng"
  const binarize = options.binarize ?? process.env.PDF_OCR_BINARIZE !== "false"
  const concurrency = Math.max(1, options.concurrency ?? Number(process.env.PDF_OCR_CONCURRENCY || 2))
  const timeoutMs = Math.max(1000, options.timeoutMs ?? Number(process.env.PDF_OCR_TIMEOUT_MS || 120000))
  const maxPages = Math.max(1, Number(process.env.PDF_OCR_MAX_PAGES || 100))
  const requestedPages = (options.pageNumbers || Array.from({ length: totalPages }, (_, index) => index + 1))
    .filter((pageNumber) => pageNumber <= maxPages)
  const results = Object.assign([], { failedPages: [] as number[], warnings: [] as string[] }) as OcrPageResults
  if (totalPages > maxPages) {
    results.warnings.push(`OCR limited to ${maxPages} pages by PDF_OCR_MAX_PAGES`)
  }

  const cachePath = path.resolve(process.env.TESSDATA_PATH || path.join(process.cwd(), ".cache", "tessdata"))
  fs.mkdirSync(cachePath, { recursive: true })

  let worker: Awaited<ReturnType<typeof createWorker>>
  try {
    worker = await createWorker(language, 1, {
      cachePath,
      langPath: process.env.TESSDATA_LANG_PATH || undefined,
      logger: (message) => {
        if (message.status === "loading language traineddata") {
          console.info(`[OCR] ${message.status}`)
        }
      },
    })
  } catch (error) {
    const message = `OCR language data could not be loaded: ${error instanceof Error ? error.message : String(error)}`
    console.error(`[OCR] ${message}`)
    results.failedPages.push(...requestedPages)
    results.warnings.push(message)
    return results
  }

  let next = 0
  const run = async () => {
    while (next < requestedPages.length) {
      const pageNumber = requestedPages[next++]
      try {
        results.push(await recognizePage(worker, pdfBuffer, pageNumber, { dpi, binarize, timeoutMs }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[OCR] ${message}`)
        results.failedPages.push(pageNumber)
        results.warnings.push(message)
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, requestedPages.length) }, run))
  } finally {
    await worker.terminate()
  }

  results.sort((left, right) => left.pageNumber - right.pageNumber)
  return results
}
