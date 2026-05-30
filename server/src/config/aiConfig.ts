export function validateAIConfig(): void {
  const missing: string[] = [];
  if (!process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (missing.length > 0) {
    console.warn(
      "[AI Config] Missing keys:",
      missing.join(", "),
      "— some AI features will be unavailable",
    );
  } else {
    console.log("[AI Config] All AI providers configured ✓");
  }
}
