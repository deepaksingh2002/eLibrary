export function buildKeyPointsPrompt(): string {
  const PREAMBLE = `You are an expert educational assistant. Below is the text extracted from a book using OCR. Please carefully review this content, identify the main chapters, and generate multiple-choice questions and key highlights based only on the chapter content. You must completely ignore any introductory material, dedications, certificates, or tables of contents found at the beginning of the document.`

  return `${PREAMBLE}\n\nRead this PDF content carefully and extract the most important learning material.

Return this exact JSON:
{
  "chapters": [
    {
      "title": "Actual chapter name from the PDF",
      "points": [
        "Key fact or concept from this chapter",
        "Second important point",
        "Third key point"
      ]
    }
  ],
  "glossary": [
    {
      "term": "Technical term from the PDF",
      "definition": "Definition as used in this PDF"
    }
  ],
  "takeaways": [
    "Practical insight from this book's actual content",
    "Second takeaway",
    "Third takeaway",
    "Fourth takeaway",
    "Fifth takeaway"
  ],
  "examTips": [
    "Specific fact or formula from this PDF likely in exams",
    "Second exam-critical item from PDF",
    "Third exam topic",
    "Fourth exam topic",
    "Fifth exam topic"
  ],
  "interviewTopics": [
    "Technical concept from this PDF asked in interviews",
    "Second interview topic from this PDF",
    "Third interview concept",
    "Fourth interview topic",
    "Fifth interview topic"
  ]
}

Rules:
- 4-6 chapters matching actual PDF structure
- 8-12 glossary terms that appear in the PDF
- examTips must be specific memorizable facts from the PDF
- interviewTopics must be conceptual questions about actual content
- ALL content must come from the PDF only`}

export const KEYPOINTS_SYSTEM_PROMPT = `
You are an educational content extractor. Return only valid JSON matching the requested schema. Ground every item in the provided PDF text; do not invent facts or include external knowledge.
`;

export default buildKeyPointsPrompt;
