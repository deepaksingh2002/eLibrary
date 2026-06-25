export function buildSummaryPrompt(): string {
  const PREAMBLE = `You are an expert educational assistant. Below is the text extracted from a book using OCR. Please carefully review this content, identify the main chapters, and generate multiple-choice questions and key highlights based only on the chapter content. You must completely ignore any introductory material, dedications, certificates, or tables of contents found at the beginning of the document.`

  return `${PREAMBLE}\n\nAnalyze this book content and return a JSON summary tailored for students and busy readers.

Return this exact JSON:
{
  "overview": "3-4 sentences about the book's actual content, main topics, and purpose. Reference specific topics from the PDF.",
  "keyThemes": ["theme from actual content", "theme 2", "theme 3", "theme 4", "theme 5"],
  "targetReader": "2-3 short persuasive sentences that explain why a reader should pick up this book: emphasize concrete benefits, actionable outcomes, and who will benefit most (e.g., students, practitioners, managers). Use an engaging, reader-attracting tone—avoid generic phrasing.",
  "difficulty": "Beginner or Intermediate or Advanced",
  "estimatedTime": "e.g. 6-8 hours"
}

Guidelines:
- Base your response ONLY on the PDF content provided above. Do not invent outside facts.
- For "targetReader", write a persuasive author-style pitch (2-4 short sentences) written in the voice of the book's author or a passionate advocate. Address the reader directly, emphasize concrete benefits and actionable outcomes, and give a compelling reason to pick up the book now. Use vivid, engaging language tied to the PDF content; avoid vague or generic phrasing.
- Use specific language tied to the PDF content; avoid vague summaries.
`}

export const SUMMARY_SYSTEM_PROMPT = `
You are a concise summarizer for students and busy readers. Return only valid JSON matching the requested schema. Use only the PDF content provided; do not hallucinate or add external facts.
`;

export default buildSummaryPrompt;
