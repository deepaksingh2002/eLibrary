"use client"
import { useState } from "react"
import { useAuthStore } from "../store/authStore"
import { useGetAiStudySummaryQuery, useGetAiStudyMcqQuery, useGetAiStudyKeyPointsQuery, useGetAiStudyFlashcardsQuery, useGetAiStudyStatusQuery } from "../store/services/api"

export type AIStudyTab = "flashcards" | "summary" | "mcq" | "keypoints"

export interface MCQQuestion {
  id: number
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}

export interface KeyPointsData {
  chapters: {
    title: string
    points: string[]
  }[]
  glossary: {
    term: string
    definition: string
  }[]
  takeaways: string[]
  examTips: string[]
  interviewTopics: string[]
  basedOnPDF: boolean
}

function normalizeKeyPointsData(data: Partial<KeyPointsData> | null | undefined): KeyPointsData | null {
  if (!data) return null

  return {
    chapters: Array.isArray(data.chapters)
      ? data.chapters.map((chapter) => ({
          title: chapter?.title || "Section",
          points: Array.isArray(chapter?.points) ? chapter.points : [],
        }))
      : [],
    glossary: Array.isArray(data.glossary)
      ? data.glossary.map((term) => ({
          term: term?.term || "",
          definition: term?.definition || "",
        }))
      : [],
    takeaways: Array.isArray(data.takeaways) ? data.takeaways : [],
    examTips: Array.isArray(data.examTips) ? data.examTips : [],
    interviewTopics: Array.isArray(data.interviewTopics) ? data.interviewTopics : [],
    basedOnPDF: Boolean(data.basedOnPDF),
  }
}

export function useAIStudy(bookId: string) {
  const [activeTab, setActiveTab] = useState<AIStudyTab>("summary")
  const [isOpen, setIsOpen] = useState(false)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  // Use RTK Query hooks to keep shapes consistent with the server
  const summaryQuery = useGetAiStudySummaryQuery(bookId, {
    skip: !(isOpen && activeTab === "summary" && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })

  const mcqQuery = useGetAiStudyMcqQuery(bookId, {
    skip: !(isOpen && activeTab === "mcq" && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })

  const keyPointsQuery = useGetAiStudyKeyPointsQuery(bookId, {
    skip: !(isOpen && activeTab === "keypoints" && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })
  const flashcardsQuery = useGetAiStudyFlashcardsQuery(bookId, {
    skip: !(isOpen && activeTab === "flashcards" && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })
  
  // Status fetch to show PDF readiness and errors
  const statusQuery = useGetAiStudyStatusQuery(bookId, {
    skip: !(isOpen && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })

  return {
    isOpen,
    activeTab,
    setActiveTab,
    openPanel: () => setIsOpen(true),
    closePanel: () => setIsOpen(false),
    // expose manual refetch helpers for UI retry buttons
    refetch: {
      summary: summaryQuery.refetch,
      mcq: mcqQuery.refetch,
      keyPoints: keyPointsQuery.refetch,
      flashcards: flashcardsQuery.refetch,
      status: statusQuery.refetch,
    },
    summary: {
      data: summaryQuery.data?.summary || null,
      isLoading: summaryQuery.isLoading || summaryQuery.isFetching,
      cached: summaryQuery.data?.cached || false,
      basedOnPDF: summaryQuery.data?.basedOnPDF || summaryQuery.data?.summary?.basedOnPDF || false,
    },
    mcq: {
      questions: (mcqQuery.data?.questions || []) as MCQQuestion[],
      isLoading: mcqQuery.isLoading || mcqQuery.isFetching,
      cached: mcqQuery.data?.cached || false,
      basedOnPDF: mcqQuery.data?.basedOnPDF || false,
      total: mcqQuery.data?.total || 0,
    },
    keyPoints: {
      data: normalizeKeyPointsData(keyPointsQuery.data?.keyPoints),
      isLoading: keyPointsQuery.isLoading || keyPointsQuery.isFetching,
      cached: keyPointsQuery.data?.cached || false,
      basedOnPDF: keyPointsQuery.data?.basedOnPDF || false,
    },
    flashcards: {
      cards: (flashcardsQuery.data?.flashcards || []) as { question: string; answer: string }[],
      isLoading: flashcardsQuery.isLoading || flashcardsQuery.isFetching,
      cached: flashcardsQuery.data?.cached || false,
      basedOnPDF: flashcardsQuery.data?.basedOnPDF || false,
      total: flashcardsQuery.data?.total || (flashcardsQuery.data?.flashcards?.length || 0),
    },
    status: {
      data: statusQuery.data || null,
      isLoading: statusQuery.isLoading || statusQuery.isFetching,
    },
  }
}
