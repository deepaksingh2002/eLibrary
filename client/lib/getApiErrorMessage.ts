import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    if ("data" in error) {
      const data = (error as FetchBaseQueryError).data;
      if (typeof data === "string") return data;
      if (
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }

    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  return fallback;
}
