import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  GoogleAIFileManager,
  FileState
} from "@google/generative-ai/server"
import * as fs   from "fs"
import * as path from "path"
import * as os   from "os"

// ─── Initialize clients ────────────────────────────────────

function getClients() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables")
  }
  return {
    genAI:       new GoogleGenerativeAI(apiKey),
    fileManager: new GoogleAIFileManager(apiKey)
  }
}

// ─── Types ────────────────────────────────────────────────

export interface UploadResult {
  success:   boolean
  fileUri:   string
  mimeType:  string
  fileSize:  number
  error?:    string
}

export interface GenerateResult {
  success: boolean
  text:    string
  error?:  string
}

// ─────────────────────────────────────────────────────────
// Upload PDF buffer to Gemini File API
//
// Gemini can natively read the uploaded PDF including:
//   - Text-based PDFs (normal digital PDFs)
//   - Scanned PDFs (image-based, no text layer)
//   - Mixed PDFs (some text, some images)
//
// Files are stored by Gemini for 48 hours then auto-deleted.
// We store the fileUri in MongoDB so we only upload once.
//
// NEVER throws — always returns UploadResult
// ─────────────────────────────────────────────────────────
export async function uploadPDFToGemini(
  buffer:      Buffer,
  displayName: string
): Promise<UploadResult> {

  // Write buffer to temp file
  // GoogleAIFileManager requires a file path, not a buffer
  const safeName = displayName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100)
  const tmpPath = path.join(os.tmpdir(), `elibrary_${Date.now()}_${safeName}`)

  try {
    const { fileManager } = getClients()

    // Write buffer to temp file
    fs.writeFileSync(tmpPath, buffer)

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2)
    console.log(
      `[GeminiPDF] Uploading "${displayName}" (${fileSizeMB} MB)`
    )

    // Upload to Gemini File API
    const uploadResponse = await fileManager.uploadFile(tmpPath, {
      mimeType:    "application/pdf",
      displayName: displayName
    })

    // Wait for file to be processed by Gemini
    // Large files take a few seconds to become ACTIVE
    let file = uploadResponse.file
    let attempts = 0
    const maxAttempts = 30  // wait max 30 seconds

    while (file.state === FileState.PROCESSING && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      file = await fileManager.getFile(file.name)
      attempts++
    }

    if (file.state === FileState.FAILED) {
      throw new Error("Gemini file processing failed")
    }

    console.log(
      `[GeminiPDF] Upload successful: ${file.uri}`
    )

    return {
      success:  true,
      fileUri:  file.uri,
      mimeType: file.mimeType || "application/pdf",
      fileSize: buffer.length
    }

  } catch (err: any) {
    console.error("[GeminiPDF] Upload failed:", err.message)
    return {
      success:  false,
      fileUri:  "",
      mimeType: "",
      fileSize: 0,
      error:    err.message || "Upload to Gemini failed"
    }
  } finally {
    // Always clean up temp file
    try { fs.unlinkSync(tmpPath) } catch {}
  }
}

// ─────────────────────────────────────────────────────────
// Re-upload a PDF from a Cloudinary URL
// Used when the stored Gemini fileUri has expired (48h)
// ─────────────────────────────────────────────────────────
export async function reUploadFromURL(
  pdfUrl:      string,
  displayName: string
): Promise<UploadResult> {

  try {
    console.log("[GeminiPDF] Downloading from URL for re-upload")
    const axios = await import("axios")

    const response = await axios.default.get(pdfUrl, {
      responseType:       "arraybuffer",
      timeout:            30000,
      maxContentLength:   80 * 1024 * 1024,  // 80MB max
      headers: {
        "User-Agent": "eLibrary-Server/1.0"
      }
    })

    const buffer = Buffer.from(response.data)
    return await uploadPDFToGemini(buffer, displayName)

  } catch (err: any) {
    console.error("[GeminiPDF] Re-upload from URL failed:", err.message)
    return {
      success:  false,
      fileUri:  "",
      mimeType: "",
      fileSize: 0,
      error:    `Could not download PDF: ${err.message}`
    }
  }
}

// ─────────────────────────────────────────────────────────
// Check if a Gemini file URI is still valid
// Gemini files expire after 48 hours
// ─────────────────────────────────────────────────────────
export async function isFileURIValid(
  fileUri: string
): Promise<boolean> {

  if (!fileUri) return false

  try {
    const { fileManager } = getClients()
    // Extract file name from URI
    // URI format: https://generativelanguage.googleapis.com/v1beta/files/FILE_ID
    const fileName = fileUri.split("/").pop() || ""
    if (!fileName) return false

    const file = await fileManager.getFile(`files/${fileName}`)
    return file.state === FileState.ACTIVE

  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────
// Generate content from an uploaded PDF file
// Gemini reads the actual PDF pages directly
// Works for both text and scanned PDFs
// ─────────────────────────────────────────────────────────
export async function generateFromPDF(params: {
  fileUri:   string
  mimeType:  string
  prompt:    string
  maxTokens: number
}): Promise<GenerateResult> {

  try {
    const { genAI } = getClients()

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens:  params.maxTokens,
        temperature:      0.2,
        responseMimeType: "application/json"
      }
    })

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: params.mimeType || "application/pdf",
          fileUri:  params.fileUri
        }
      },
      {
        text: params.prompt
      }
    ])

    const text = result.response.text().trim()
    return { success: true, text }

  } catch (err: any) {
    console.error("[GeminiPDF] Generate failed:", err.message)
    return {
      success: false,
      text:    "",
      error:   err.message
    }
  }
}

// ─────────────────────────────────────────────────────────
// Get or refresh the Gemini fileUri for a book
// Checks if stored URI is valid, re-uploads if expired
// This is called before every AI generation request
// ─────────────────────────────────────────────────────────
export async function getValidFileURI(book: {
  _id:            string
  title:          string
  pdfUrl:         string
  geminiFileUri:  string
  geminiMimeType: string
}): Promise<{ fileUri: string; mimeType: string; error?: string }> {

  // Check if stored URI is still valid
  if (book.geminiFileUri) {
    const valid = await isFileURIValid(book.geminiFileUri)
    if (valid) {
      console.log("[GeminiPDF] Using existing valid URI for:", book.title)
      return {
        fileUri:  book.geminiFileUri,
        mimeType: book.geminiMimeType || "application/pdf"
      }
    }
    console.log("[GeminiPDF] Stored URI expired, re-uploading:", book.title)
  }

  // URI is missing or expired — re-upload from Cloudinary
  if (!book.pdfUrl) {
    return {
      fileUri:  "",
      mimeType: "",
      error:    "No PDF URL stored for this book"
    }
  }

  const uploadResult = await reUploadFromURL(
    book.pdfUrl,
    `${book.title}.pdf`
  )

  if (!uploadResult.success) {
    return {
      fileUri:  "",
      mimeType: "",
      error:    uploadResult.error
    }
  }

  // Save new URI to database
  const Book = (await import("../models/Book")).default
  await Book.findByIdAndUpdate(book._id, {
    geminiFileUri:    uploadResult.fileUri,
    geminiMimeType:   uploadResult.mimeType,
    extractionStatus: "ready",
    extractedAt:      new Date()
  })

  return {
    fileUri:  uploadResult.fileUri,
    mimeType: uploadResult.mimeType
  }
}
