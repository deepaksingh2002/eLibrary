"use client";
import type * as PdfjsLib from "pdfjs-dist";

let pdfjsLib: typeof PdfjsLib | null = null;

function getLocalWorkerSrc(): string {
  return new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
}

export async function getPdfjsLib(): Promise<typeof PdfjsLib> {
  if (pdfjsLib) return pdfjsLib;

  const lib = await import("pdfjs-dist");
  pdfjsLib = lib;

  if (typeof window !== "undefined") {
    lib.GlobalWorkerOptions.workerSrc = getLocalWorkerSrc();
  }

  return lib;
}

export default getPdfjsLib;
