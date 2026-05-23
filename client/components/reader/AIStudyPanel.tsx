"use client"
import React, { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAIStudy, AIStudyTab } from "../../hooks/useAIStudy"
import { useAuthStore } from "../../store/authStore"
import BookSummary from "./BookSummary"
import MCQQuiz from "./MCQQuiz"
import KeyPoints from "./KeyPoints"
import Flashcards from "./Flashcards"

interface Props {
  bookId: string
  bookTitle: string
}

export default function AIStudyPanel({ bookId, bookTitle }: Props) {
  const { isOpen, activeTab, setActiveTab, openPanel, closePanel, summary, mcq, keyPoints, flashcards, refetch, status } = useAIStudy(bookId)
  const { user, isAuthenticated } = useAuthStore()
  const pathname = usePathname()
  const signInHref = `/login?returnUrl=${encodeURIComponent(pathname || "/")}`

  const tabs: { key: AIStudyTab; icon: string; label: string }[] = [
    { key: "flashcards", icon: "🃏", label: "Flashcards" },
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
      const order: AIStudyTab[] = ["flashcards", "summary", "mcq", "keypoints"]
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
              ✅ LangChain PDF mode
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Reads the uploaded PDF and generates study content directly from it.
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-5 dark:bg-slate-950">
          {!isAuthenticated && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm mb-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 text-sm font-semibold">Sign in to use AI Study</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI features require authentication. Please log in to generate summaries, quizzes, and flashcards from PDFs.</p>
              <div className="mt-4">
                <Link href={signInHref} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Sign in
                </Link>
              </div>
            </div>
          )}
          {/* Show PDF / extraction status to users */}
          {!status.isLoading && status.data && !status.data.hasPdf && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm mb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">No PDF available</div>
                  <div className="mt-1 text-sm">This book doesn't have a PDF uploaded. AI Study features require the PDF to generate content.</div>
                </div>
                <div className="flex-shrink-0">
                  <button onClick={() => refetch.status?.()} className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Refresh</button>
                </div>
              </div>
            </div>
          )}

          {!status.isLoading && status.data && !status.data.isReady && status.data.hasPdf && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm mb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">PDF processing in progress</div>
                  <div className="mt-1 text-sm">Status: {status.data.extractionStatus || 'processing'}. Try again in a few minutes or ask an admin to check the PDF.</div>
                </div>
                <div className="flex-shrink-0">
                  <button onClick={() => refetch.status?.()} className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Refresh</button>
                </div>
              </div>
            </div>
          )}
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" hidden={activeTab !== "summary"} tabIndex={0}>
            <BookSummary summary={summary.data} isLoading={summary.isLoading} cached={summary.cached} basedOnPDF={summary.basedOnPDF} />
          </div>

          <div role="tabpanel" id="panel-flashcards" aria-labelledby="tab-flashcards" hidden={activeTab !== "flashcards"} tabIndex={0}>
            {/* If AI failed for flashcards, show error + canned flashcards */}
            {!flashcards.isLoading && flashcards.cards.length === 0 && flashcards.basedOnPDF && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100 mb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">⚠️ AI flashcards unavailable</div>
                    <div className="mt-1">We couldn't generate flashcards right now. Try retrying or use the sample flashcards below.</div>
                  </div>
                  <div className="flex-shrink-0">
                    <button onClick={() => refetch.flashcards()} className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Retry</button>
                  </div>
                </div>
              </div>
            )}

            {!flashcards.isLoading && flashcards.cards.length === 0 && flashcards.basedOnPDF && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 mb-4">
                <div className="font-semibold mb-2">Sample flashcards (fallback)</div>
                <ul className="space-y-3 text-sm">
                  <li>
                    <div className="font-medium">Q: What is a greedy algorithm?</div>
                    <div className="text-slate-500">A: An algorithm that makes the locally optimal choice at each step.</div>
                  </li>
                  <li>
                    <div className="font-medium">Q: Which data structure supports FIFO?</div>
                    <div className="text-slate-500">A: Queue.</div>
                  </li>
                </ul>
              </div>
            )}

            <Flashcards cards={flashcards.cards} isLoading={flashcards.isLoading} />
          </div>

          <div role="tabpanel" id="panel-mcq" aria-labelledby="tab-mcq" hidden={activeTab !== "mcq"} tabIndex={0}>
            <div className="space-y-4">
              {/* If AI returned no questions but indicates it read the PDF, show a clear error and fallback */}
              {!mcq.isLoading && mcq.questions.length === 0 && mcq.basedOnPDF && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">⚠️ AI generation currently unavailable</div>
                      <div className="mt-1">We tried to generate quiz questions but the AI service returned no results. This is usually temporary (quota or rate limits).</div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => refetch.mcq()}
                        className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Render canned fallback MCQs when AI fails */}
              {!mcq.isLoading && mcq.questions.length === 0 && mcq.basedOnPDF && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
                  <div className="font-semibold mb-2">Sample practice questions (fallback)</div>
                  <ol className="list-decimal list-inside space-y-3">
                    <li>
                      <div className="font-medium">What is the primary purpose of the book "{bookTitle}"?</div>
                      <div className="text-sm text-slate-500">A short conceptual question to test understanding of the book's goal.</div>
                    </li>
                    <li>
                      <div className="font-medium">Which data structure is commonly used to implement a priority queue?</div>
                      <div className="text-sm text-slate-500">Heap (binary heap) — useful for understanding algorithmic implementations.</div>
                    </li>
                    <li>
                      <div className="font-medium">Name one example of a greedy algorithm covered in the book.</div>
                      <div className="text-sm text-slate-500">(Example answer: Activity selection or coin change depending on content.)</div>
                    </li>
                  </ol>
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
            <span>Powered by LangChain AI</span>
            <span>Cached for 48 hours</span>
          </div>
        </div>
      </div>
    </>
  )
}
