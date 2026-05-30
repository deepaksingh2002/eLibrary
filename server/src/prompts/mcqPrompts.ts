// ─── Concept Extraction ──────────────────────────────────────────────────────

export const CONCEPT_EXTRACTION_SYSTEM_PROMPT = `\
You extract study concepts from retrieved textbook context.
OUTPUT RULES — non-negotiable:
- Return raw JSON only. No markdown fences, no prose, no preamble, no trailing text.
- Use only information explicitly stated in the supplied context.
- Skip OCR artifacts, page headers/footers, publisher boilerplate, copyright lines,
  ISBN numbers, MEAP/Manning notices, incomplete sentences, and figure captions.
- If a concept cannot be fully supported by the context, omit it entirely.`

export function buildConceptExtractionPrompt(params: {
  bookTitle: string
  chapterFocus?: string
  context: string
  maxConcepts: number
}): string {
  return `\
Book: ${params.bookTitle}
Chapter: ${params.chapterFocus ?? "unspecified"}

<context>
${params.context}
</context>

Extract up to ${params.maxConcepts} educational concepts that are **explicitly and fully** supported by the context above.

Each concept must have:
- "name"       — concise concept name (no chapter or section references)
- "definition" — one self-contained sentence; no filler phrases like "refers to" or "is defined as"
- "evidence"   — one short paraphrase (not a quote) drawn from the context

Reject any concept that would require outside knowledge or inference beyond the context.

Respond with ONLY this JSON — no other text:
{"concepts":[{"name":"...","definition":"...","evidence":"..."}]}`
}

// ─── MCQ Generation ──────────────────────────────────────────────────────────

export const MCQ_GENERATION_SYSTEM_PROMPT = `\
You are an expert educator and quiz designer.
OUTPUT RULES — non-negotiable:
- Return raw JSON only. No markdown fences, no prose, no preamble, no trailing text.
- Return ONLY a valid JSON array.
- Follow the prompt instructions exactly.
- Do not add any extra keys, explanations, markdown, or commentary.`

export function buildMcqGenerationPrompt(): string {
  return `\
You are an expert educator and quiz designer. Generate {num_questions} polished,
professional MCQs from the chapter content below.

STRICT RULES:

1. QUESTION TYPES - each MCQ must use one of these types, and no type can repeat 
   more than 3 times across all questions:
   - conceptual: test understanding of a concept
   - applied: give a scenario, ask what happens
   - comparison: difference between two things
   - numerical: compute or reason a value
   - why_purpose: ask WHY something works or is used
   - consequence: what happens if a condition is not met

2. CONTENT RULES:
   - Every question must test a DIFFERENT concept from the chapter
   - Never ask the same concept twice even with different wording
  - Keep the wording specific, academic, and concise
  - NEVER use the phrasing "which statement best captures" or "which phrase describes"
   - Do NOT copy sentences from the text as answer options — write options in your 
     own words
   - All 4 options must be plausible, not obviously wrong

3. ANTI-REPETITION:
   - No two questions share the same concept
   - No answer option text is reused across different questions
   - No question type appears more than 3 times
  - Avoid generic stems like "which of the following is true" unless the passage
    is too short to support a more specific question

OUTPUT FORMAT:
Return a valid JSON array only. No explanation, no markdown, no extra text.

[
  {{
    "question_number": 1,
    "concept_tested": "string — the specific concept this question tests",
    "question_type": "conceptual | applied | comparison | numerical | why_purpose | consequence",
    "question": "string",
    "options": {{
      "A": "string",
      "B": "string",
      "C": "string",
      "D": "string"
    }},
    "correct_answer": "A | B | C | D",
    "explanation": "1-2 sentence explanation of why the answer is correct"
  }}
]

CHAPTER CONTENT:
{chapter_text}

--- END OF NEW PROMPT ---`
}