"use client";
import type * as PdfjsLib from "pdfjs-dist";

let pdfjsLib: typeof PdfjsLib | null = null;

export async function getPdfjsLib(): Promise<typeof PdfjsLib> {
  if (pdfjsLib) return pdfjsLib;

  const lib = await import("pdfjs-dist");
  pdfjsLib = lib;

  if (typeof window !== "undefined") {
    lib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
  }

  return lib;
}

export default getPdfjsLib;
