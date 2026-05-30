// Simple test script to check Gemini API connectivity
// Usage: `node -e "require('dotenv').config(); require('./scripts/test_gemini.js')"`

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

if (!apiKey) {
  console.error("ERROR: GEMINI_API_KEY is not set in the environment.");
  process.exit(1);
}

const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

async function main() {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Reply with only: GEMINI_OK" }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Gemini API returned error:", res.status, JSON.stringify(data, null, 2));
      process.exit(2);
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("\n")
        .trim() || "";

    console.log("Gemini API OK");
    console.log("Model:", model);
    console.log("Response:", text || "<empty>");
  } catch (error) {
    console.error("Request failed:", error instanceof Error ? error.message : String(error));
    process.exit(99);
  }
}

main();
