export interface LearningPage {
  pageNumber: number
  text: string
  chapter?: string
  bookName?: string
}

export interface ChapterMetadata {
  chapter: string
  startPage: number
  endPage: number
}

export interface ChapterChunk {
  chunkIndex: number
  content: string
  chapter: string
  page: number
  bookName: string
}

export interface ExtractedConcept {
  name: string
  definition: string
  evidence: string
  page?: number
}

export interface GeneratedMCQ {
  question: string
  options: string[]
  answer: string
  explanation: string
}

export interface StudyMCQQuestion {
  id: number
  question: string
  options: {
    A: string
    B: string
    C: string
    D: string
  }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}
