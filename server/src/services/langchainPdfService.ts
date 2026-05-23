import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";

export interface LangChainPdfResult {
  success: boolean;
  text: string;
  pages: number;
  error?: string;
}

export interface LangChainGenerateResult {
  success: boolean;
  text: string;
  error?: string;
}

function extractTextFromModelResponse(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function cleanupJson(text: string): string {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

async function extractPdfTextFromUrl(params: {
  pdfUrl: string;
  title: string;
}): Promise<LangChainPdfResult> {
  const safeTitle = params.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const tmpPath = path.join(os.tmpdir(), `elibrary_${Date.now()}_${safeTitle}.pdf`);

  try {
    const response = await axios.get(params.pdfUrl, {
      responseType: "arraybuffer",
      timeout: 45000,
      maxContentLength: 80 * 1024 * 1024,
      headers: { "User-Agent": "eLibrary-Server/1.0" },
    });

    fs.writeFileSync(tmpPath, Buffer.from(response.data));

    const { PDFLoader } = await import("@langchain/community/document_loaders/fs/pdf");
    const loader = new PDFLoader(tmpPath, {
      splitPages: true,
    });

    const docs = await loader.load();
    const text = docs
      .map((doc) => doc.pageContent)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return {
        success: false,
        text: "",
        pages: docs.length,
        error: "No readable text found in PDF",
      };
    }

    return {
      success: true,
      text,
      pages: docs.length,
    };
  } catch (err: any) {
    return {
      success: false,
      text: "",
      pages: 0,
      error: err?.message || "Failed to extract PDF text",
    };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore temp-file cleanup errors
    }
  }
}

async function buildContext(text: string): Promise<string> {
  const { RecursiveCharacterTextSplitter } = await import("@langchain/textsplitters");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1800,
    chunkOverlap: 220,
  });

  const docs = await splitter.createDocuments([text]);
  const selected = docs.slice(0, 24);

  return selected
    .map((doc, i) => `[Chunk ${i + 1}]\n${doc.pageContent}`)
    .join("\n\n");
}

export async function generateFromPdfWithLangChain(params: {
  pdfUrl: string;
  title: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<LangChainGenerateResult> {
  const googleKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!googleKey && !openAiKey) {
    return {
      success: false,
      text: "",
      error: "No AI provider key configured (GEMINI_API_KEY or OPENAI_API_KEY required)",
    };
  }

  const extraction = await extractPdfTextFromUrl({
    pdfUrl: params.pdfUrl,
    title: params.title,
  });

  if (!extraction.success) {
    return {
      success: false,
      text: "",
      error: extraction.error || "Could not extract PDF text",
    };
  }

  try {
    const context = await buildContext(extraction.text);

    const finalPrompt = [
      "You must return only strict JSON. Do not add markdown fences.",
      `Book title: ${params.title}`,
      `Extracted pages: ${extraction.pages}`,
      "PDF context:",
      context,
      "Task:",
      params.prompt,
    ].join("\n\n");

    let rawText = "";

    if (googleKey) {
      const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
      const model = new ChatGoogleGenerativeAI({
        apiKey: googleKey,
        model: "gemini-2.0-flash",
        temperature: 0.2,
        maxOutputTokens: params.maxOutputTokens,
      });

      const response = await (model as any).invoke(finalPrompt);
      rawText = extractTextFromModelResponse(response.content);
    } else {
      const openaiMod = await import("@langchain/openai");
      // Support different export names across versions
      const ChatOpenAI: any = openaiMod.ChatOpenAI || openaiMod.OpenAI || openaiMod.default;
      const model = new ChatOpenAI({
        apiKey: openAiKey,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: params.maxOutputTokens,
      } as any);

      const response = await (model as any).invoke(finalPrompt);
      rawText = extractTextFromModelResponse(response.content);
    }

    if (!rawText) {
      return {
        success: false,
        text: "",
        error: "Model returned an empty response",
      };
    }

    return {
      success: true,
      text: cleanupJson(rawText),
    };
  } catch (err: any) {
    return {
      success: false,
      text: "",
      error: err?.message || "LangChain generation failed",
    };
  }
}
