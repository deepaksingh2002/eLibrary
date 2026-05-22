"use client"
import { useState } from "react"
import { useAuthStore } from "../store/authStore"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

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

  const summaryQuery = useQuery({
    queryKey: ["ai-summary", bookId],
    queryFn: () =>
      api.get(`/api/ai-study/${bookId}/summary`).then((r) => r.data),
    enabled: isOpen && activeTab === "summary" && !!bookId && useAuthStore.getState().isAuthenticated,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    retry: 1,
  })

  const mcqQuery = useQuery({
    queryKey: ["ai-mcq", bookId],
    queryFn: () =>
      api.get(`/api/ai-study/${bookId}/mcq?count=10`).then((r) => r.data),
    enabled: isOpen && activeTab === "mcq" && !!bookId && useAuthStore.getState().isAuthenticated,
    staleTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  })

  const keyPointsQuery = useQuery({
    queryKey: ["ai-keypoints", bookId],
    queryFn: () =>
      api.get(`/api/ai-study/${bookId}/key-points`).then((r) => r.data),
    enabled: isOpen && activeTab === "keypoints" && !!bookId && useAuthStore.getState().isAuthenticated,
    staleTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  })

  const flashcardsQuery = useQuery({
    queryKey: ["ai-flashcards", bookId],
    queryFn: () => api.get(`/api/ai-study/${bookId}/flashcards?count=8`).then((r) => r.data),
    enabled: isOpen && activeTab === "flashcards" && !!bookId && useAuthStore.getState().isAuthenticated,
    staleTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
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
    },
    summary: {
      data: summaryQuery.data?.summary || null,
      isLoading: summaryQuery.isLoading || summaryQuery.isFetching,
      cached: summaryQuery.data?.cached || false,
      basedOnPDF: summaryQuery.data?.basedOnPDF || false,
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
  }
}
