"use client"
import { useMemo, useState, useEffect, useCallback } from "react"
import { useAuthStore } from "../store/authStore"
import { useGetAiStudyMcqQuery, useGetAiStudyKeyPointsQuery, useGetAiStudyStatusQuery, useGetAiStudyChapterIndexQuery } from "../store/services/api"

export type AIStudyTab = "mcq" | "keypoints"

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
    number?: number
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

export interface ChapterOption {
  value: string
  label: string
  number?: number
  startPage?: number
  endPage?: number
}

function normalizeKeyPointsData(data: Partial<KeyPointsData> | null | undefined): KeyPointsData | null {
  if (!data) return null

  return {
    chapters: Array.isArray(data.chapters)
      ? data.chapters.map((chapter) => ({
          number: typeof chapter?.number === "number" ? chapter.number : undefined,
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

function getQueryErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null

  const data = "data" in error ? (error as { data?: unknown }).data : null
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error
    return typeof message === "string" && message.trim().length > 0 ? message : null
  }

  return null
}

export function useAIStudy(bookId: string) {
  const [activeTab, setActiveTab] = useState<AIStudyTab>("mcq")
  const [isOpen, setIsOpen] = useState(false)
  const [keyPointsNonce, setKeyPointsNonce] = useState(0)
  const [mcqNonce, setMcqNonce] = useState(0)
  const [selectedChapter, setSelectedChapter] = useState<string>("")
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openPanel = useCallback(() => setIsOpen(true), [])
  const closePanel = useCallback(() => setIsOpen(false), [])

  const chapterIndexQuery = useGetAiStudyChapterIndexQuery(bookId, {
    skip: !(isOpen && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })

  const chapterIndexLoading = chapterIndexQuery.isLoading || chapterIndexQuery.isFetching
  const hasChapterIndex = (chapterIndexQuery.data?.chapterIndex?.chapters?.length || 0) > 0
  const shouldFetchMcq = isOpen && activeTab === "mcq" && !!bookId && isAuthenticated && (!chapterIndexLoading && (!hasChapterIndex || !!selectedChapter))

  // Auto-select the first chapter when an index is available and none is selected
  useEffect(() => {
    if (hasChapterIndex && !selectedChapter) {
      const first = chapterIndexQuery.data?.chapterIndex?.chapters?.[0]
      if (first) setSelectedChapter(String(first.number))
    }
  }, [hasChapterIndex, chapterIndexQuery.data, selectedChapter])

  const mcqQuery = useGetAiStudyMcqQuery(
    {
      bookId,
      count: 10,
      fresh: mcqNonce,
      chapter: selectedChapter || undefined,
    },
    {
      skip: !shouldFetchMcq,
      refetchOnMountOrArgChange: false,
    },
  )
  const mcqData = mcqQuery.currentData

  const keyPointsQuery = useGetAiStudyKeyPointsQuery({ bookId, fresh: keyPointsNonce }, {
    skip: !(isOpen && activeTab === "keypoints" && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })
  // Status fetch to show PDF readiness and errors
  const statusQuery = useGetAiStudyStatusQuery(bookId, {
    skip: !(isOpen && !!bookId && isAuthenticated),
    refetchOnMountOrArgChange: false,
  })

  const mcqError = mcqData?.error || getQueryErrorMessage(mcqQuery.error)

  return {
    isOpen,
    activeTab,
    setActiveTab,
    selectedChapter,
    setSelectedChapter,
    openPanel,
    closePanel,
    // expose manual refetch helpers for UI retry buttons
    refetch: {
      mcq: () => {
        setMcqNonce((value) => value + 1)
      },
      keyPoints: () => setKeyPointsNonce((value) => value + 1),
      status: statusQuery.refetch,
    },
    chapterOptions: useMemo<ChapterOption[]>(() => {
      const chapterIndexOptions = chapterIndexQuery.data?.chapterIndex?.chapters?.map((chapter) => {
        let label = chapter.title || `Chapter ${chapter.number}`
        if (chapter.title && !/^(chapter|chap|part|appendix)\b/i.test(chapter.title.trim())) {
          label = `Chapter ${chapter.number}: ${chapter.title}`
        }
        return {
          value: String(chapter.number),
          label,
          number: chapter.number,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
        }
      }) || []

      if (chapterIndexOptions.length > 0) {
        return chapterIndexOptions
      }

      return []
    }, [chapterIndexQuery.data]),
    chapterIndex: chapterIndexQuery.data?.chapterIndex?.chapters || [],
    mcq: {
      questions: (mcqData?.questions || []) as MCQQuestion[],
      isLoading: mcqQuery.isLoading || mcqQuery.isFetching,
      cached: mcqData?.cached || false,
      basedOnPDF: mcqData?.basedOnPDF || false,
      fallbackUsed: mcqData?.fallbackUsed || false,
      total: mcqData?.total || 0,
      error: mcqError,
    },
    keyPoints: {
      data: normalizeKeyPointsData(keyPointsQuery.data?.keyPoints),
      isLoading: keyPointsQuery.isLoading || keyPointsQuery.isFetching,
      cached: keyPointsQuery.data?.cached || false,
      basedOnPDF: keyPointsQuery.data?.basedOnPDF || false,
    },
    status: {
      data: statusQuery.data || null,
      isLoading: statusQuery.isLoading || statusQuery.isFetching,
    },
  }
}
