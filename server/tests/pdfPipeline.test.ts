/// <reference types="jest" />

import http from "http"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { rasterizePdfPage } from "../src/ocr/ocrService"
import { processBookPdf } from "../src/services/pdfPipelineService"

jest.setTimeout(120000)

async function serve(buffer: Buffer): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((_request, response) => {
    response.end(buffer)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  const address = server.address() as { port: number }
  return { url: `http://127.0.0.1:${address.port}/book.pdf`, close: () => server.close() }
}

async function createTextPdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([612, 792])
  page.drawText(
    "This is a normal native text page containing enough words for the page quality threshold. The document includes copyright information and many additional descriptive words so native extraction remains the selected source.",
    { x: 40, y: 700, font, size: 10, maxWidth: 520, lineHeight: 14 },
  )
  return Buffer.from(await pdf.save())
}

test("rasterizePdfPage renders a PNG with PDF dimensions", async () => {
  const pdf = await createTextPdf()
  const png = await rasterizePdfPage(pdf, 1, 100)
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
  expect(png.length).toBeGreaterThan(100)
})

test("native text PDFs retain copyright by default", async () => {
  const served = await serve(await createTextPdf())
  try {
    const result = await processBookPdf(served.url, "Native text")
    expect(result.success).toBe(true)
    expect(result.source).toBe("text")
    expect(result.text.toLowerCase()).toContain("copyright")
  } finally {
    served.close()
  }
})

test("corrupt PDFs return a failure result without throwing", async () => {
  const served = await serve(Buffer.from("not a PDF"))
  try {
    const result = await processBookPdf(served.url, "Corrupt")
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/PDF|document|invalid|objects/i)
  } finally {
    served.close()
  }
})
