"use client"
import React, { useEffect, useRef } from "react"
import { useAIStudy, AIStudyTab } from "../../hooks/useAIStudy"
import BookSummary from "./BookSummary"
import MCQQuiz from "./MCQQuiz"
import KeyPoints from "./KeyPoints"

interface Props {
  bookId: string
  bookTitle: string
}

export default function AIStudyPanel({ bookId, bookTitle }: Props) {
  const { isOpen, activeTab, setActiveTab, openPanel, closePanel, summary, mcq, keyPoints } = useAIStudy(bookId)

  const tabs: { key: AIStudyTab; icon: string; label: string }[] = [
    { key: "summary", icon: "📋", label: "Summary" },
    { key: "mcq", icon: "❓", label: "MCQ Quiz" },
    { key: "keypoints", icon: "🗝️", label: "Key Points + Interview" },
  ]

  const tabListRef = useRef<HTMLDivElement | null>(null)

  // Keyboard navigation for tabs and Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === "Escape") {
        closePanel()
        return
      }
      const keys = ["ArrowLeft", "ArrowRight"]
      if (!keys.includes(e.key)) return

      const order: AIStudyTab[] = ["summary", "mcq", "keypoints"]
      const idx = order.indexOf(activeTab)
      if (e.key === "ArrowLeft") setActiveTab(order[(idx - 1 + order.length) % order.length])
      if (e.key === "ArrowRight") setActiveTab(order[(idx + 1) % order.length])
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, activeTab, setActiveTab, closePanel])

  return (
    <>
      <button
        onClick={openPanel}
        className="fixed bottom-6 right-4 z-[9999] inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-300 md:bottom-6 md:right-6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base backdrop-blur">
          ✨
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span>AI Study</span>
          <span className="text-[11px] font-normal text-blue-100">Summary • Quiz • Insights</span>
        </span>
      </button>

      {isOpen && <div className="fixed inset-0 z-[9998] bg-slate-950/50 backdrop-blur-sm" onClick={closePanel} />}

      <div
        className={`fixed right-0 top-0 z-[10000] flex h-full w-full max-w-[46rem] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-950 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-5 text-white dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100/90">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15">✨</span>
                AI Study Assistant
              </div>
              <h2 className="mt-2 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {bookTitle}
              </h2>
              <p className="mt-1 text-sm text-blue-100/90">
                Clean summaries, practice questions, and revision notes in one place.
              </p>
            </div>

            <button
              onClick={closePanel}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white transition-colors hover:bg-white/20"
              aria-label="Close AI study panel"
            >
              ×
            </button>
          </div>

          <div
            ref={tabListRef}
            role="tablist"
            aria-label="AI Study Tabs"
            className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-1 backdrop-blur"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-controls={`panel-${tab.key}`}
                aria-selected={activeTab === tab.key}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  activeTab === tab.key ? "bg-white text-blue-700 shadow-sm" : "text-blue-100 hover:bg-white/10"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
              ✅ Gemini PDF mode
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Reads the uploaded PDF directly for more accurate results.
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-5 dark:bg-slate-950">
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" hidden={activeTab !== "summary"} tabIndex={0}>
            <BookSummary summary={summary.data} isLoading={summary.isLoading} cached={summary.cached} basedOnPDF={summary.basedOnPDF} />
          </div>

          <div role="tabpanel" id="panel-mcq" aria-labelledby="tab-mcq" hidden={activeTab !== "mcq"} tabIndex={0}>
            <div className="space-y-4">
              {!mcq.isLoading && mcq.questions.length === 0 && !mcq.cached && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
                  <span className="font-semibold">📌 Practice mode:</span> Gemini is generating quiz questions from the PDF. This usually takes just a few seconds.
                </div>
              )}
              <MCQQuiz questions={mcq.questions} isLoading={mcq.isLoading} />
            </div>
          </div>

          <div role="tabpanel" id="panel-keypoints" aria-labelledby="tab-keypoints" hidden={activeTab !== "keypoints"} tabIndex={0}>
            <KeyPoints data={keyPoints.data} isLoading={keyPoints.isLoading} basedOnPDF={keyPoints.basedOnPDF} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Powered by Google Gemini AI</span>
            <span>Cached for 48 hours</span>
          </div>
        </div>
      </div>
    </>
  )
}
