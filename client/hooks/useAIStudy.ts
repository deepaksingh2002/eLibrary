"use client";

import { useState } from "react";
import {
  useGetAiStudySummaryQuery,
  useGetAiStudyMcqQuery,
  useGetAiStudyKeyPointsQuery,
} from "../store/services/api";

export type AIStudyTab = "summary" | "mcq" | "keypoints"

export interface MCQQuestion {
  id: number
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
}

export function useAIStudy(bookId: string) {
  const [activeTab, setActiveTab] = useState<AIStudyTab>("summary");
  const [isOpen, setIsOpen] = useState(false);

  const summaryQuery = useGetAiStudySummaryQuery(bookId, {
    skip: !(isOpen && activeTab === "summary" && !!bookId),
  });

  const mcqQuery = useGetAiStudyMcqQuery(bookId, {
    skip: !(isOpen && activeTab === "mcq" && !!bookId),
  });

  const keyPointsQuery = useGetAiStudyKeyPointsQuery(bookId, {
    skip: !(isOpen && activeTab === "keypoints" && !!bookId),
  });

  const openPanel = () => setIsOpen(true);
  const closePanel = () => setIsOpen(false);

  return {
    isOpen,
    activeTab,
    setActiveTab,
    openPanel,
    closePanel,
    summary: {
      data: summaryQuery.data?.summary || null,
      isLoading: summaryQuery.isLoading,
      isFetching: summaryQuery.isFetching,
      cached: summaryQuery.data?.cached || false,
    },
    mcq: {
      questions: mcqQuery.data?.questions || [],
      isLoading: mcqQuery.isLoading,
      isFetching: mcqQuery.isFetching,
      cached: mcqQuery.data?.cached || false,
    },
    keyPoints: {
      data: keyPointsQuery.data?.keyPoints || null,
      isLoading: keyPointsQuery.isLoading,
      isFetching: keyPointsQuery.isFetching,
      cached: keyPointsQuery.data?.cached || false,
    },
  };
}
