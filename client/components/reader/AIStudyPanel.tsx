"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAIStudy, AIStudyTab } from "../../hooks/useAIStudy"
import { useAuthStore } from "../../store/authStore"
import MCQQuiz from "./MCQQuiz"
import KeyPoints from "./KeyPoints"

interface Props {
  bookId: string
  bookTitle: string
}

export default function AIStudyPanel({ bookId, bookTitle }: Props) {
  const { isOpen, activeTab, setActiveTab, openPanel, closePanel, mcq, keyPoints, refetch, status, selectedChapter, setSelectedChapter, chapterOptions } = useAIStudy(bookId)
  const { isAuthenticated } = useAuthStore()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const signInHref = `/login?returnUrl=${encodeURIComponent(pathname || "/")}`
  const selectedChapterLabel = chapterOptions.find((option) => option.value === selectedChapter)?.label || (selectedChapter ? `Chapter ${selectedChapter}` : "All chapters")
  const contextLabel = mcq.basedOnPDF
    ? "OCR-cleaned PDF context"
    : chapterOptions.length > 0
      ? "Chapter index context"
      : "Metadata fallback context"

  const tabs: { key: AIStudyTab; icon: string; label: string }[] = [
    { key: "mcq", icon: "❓", label: "MCQ Quiz" },
    { key: "keypoints", icon: "🗝️", label: "Key Points + Interview" },
  ]

  // Keyboard navigation for tabs and Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === "Escape") {
        setMobileMenuOpen(false)
        closePanel()
        return
      }
      const keys = ["ArrowLeft", "ArrowRight"]
      if (!keys.includes(e.key)) return
      const order: AIStudyTab[] = ["mcq", "keypoints"]
      const idx = order.indexOf(activeTab)
      if (e.key === "ArrowLeft") setActiveTab(order[(idx - 1 + order.length) % order.length])
      if (e.key === "ArrowRight") setActiveTab(order[(idx + 1) % order.length])
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, activeTab, setActiveTab, closePanel])

  useEffect(() => {
    if (!isOpen) {
      setMobileMenuOpen(false)
    }
  }, [isOpen])

  return (
    <>
      <button
        onClick={openPanel}
        className="fixed bottom-6 right-4 z-9999 inline-flex items-center gap-3 rounded-full bg-linear-to-r from-blue-600 via-indigo-600 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-300 md:bottom-6 md:right-6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base backdrop-blur">
          ✨
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span>AI Study</span>
          <span className="text-[11px] font-normal text-blue-100">Quiz • Insights</span>
        </span>
      </button>

      {isOpen && <div className="fixed inset-0 z-9998 bg-slate-950/50 backdrop-blur-sm" onClick={closePanel} />}

      <div
        className={`fixed inset-0 z-10000 flex h-screen w-screen flex-col overflow-hidden bg-slate-50 shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-950 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%),linear-gradient(135deg,#2563eb,#4f46e5_55%,#0f172a)] px-4 py-4 text-white dark:border-slate-800 sm:px-5 sm:py-5">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:hidden"
              aria-label="Open study menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <button
              onClick={closePanel}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white transition-colors hover:bg-white/20"
              aria-label="Close AI study panel"
            >
              ×
            </button>

            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-100/90">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15">✨</span>
                AI Study Assistant
              </div>
              <h2 className="mt-2 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {bookTitle}
              </h2>
              <p className="mt-1 text-sm text-blue-100/90">
                Practice questions and revision notes in one place.
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="AI Study Tabs"
            className="mt-4 hidden grid-cols-2 gap-2 rounded-2xl bg-white/10 p-1 backdrop-blur md:grid"
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

        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white/95 px-4 py-4 text-slate-900 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100 md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Study menu</div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="grid gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setMobileMenuOpen(false)
                  }}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Selected: {selectedChapterLabel}
            </div>
          </div>
        )}

        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
              ✅ PDF-backed study pack
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Focus a chapter for MCQs, and refresh the quiz with one click.
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
              Selected: {selectedChapterLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium dark:bg-slate-800">
              {contextLabel}
            </span>
          </div>
          {mcq.fallbackUsed && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              Showing fallback MCQs because Gemini hit a quota or rate limit.
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.96))] p-4 sm:p-5 dark:bg-slate-950">
          {!isAuthenticated && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm mb-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 text-sm font-semibold">Sign in to use AI Study</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI features require authentication. Please log in to generate summaries, quizzes, and study notes from PDFs.</p>
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
                  <div className="mt-1 text-sm">This book doesn&apos;t have a PDF uploaded. AI Study features require the PDF to generate content.</div>
                </div>
                <div className="shrink-0">
                  <button onClick={() => refetch.status()} className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Refresh</button>
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
                <div className="shrink-0">
                  <button onClick={() => refetch.status()} className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Refresh</button>
                </div>
              </div>
            </div>
          )}
          <div role="tabpanel" id="panel-mcq" aria-labelledby="tab-mcq" hidden={activeTab !== "mcq"} tabIndex={0}>
            <div className="space-y-4">
              {/* If AI returned no questions but indicates it read the PDF, show a clear error and fallback */}
              {!mcq.isLoading && mcq.questions.length === 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">⚠️ AI generation currently unavailable</div>
                      <div className="mt-1">{mcq.error || "We tried to generate quiz questions but the AI service returned no results."}</div>
                    </div>
                    <div className="shrink-0">
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

              <MCQQuiz
                questions={mcq.questions}
                isLoading={mcq.isLoading}
                chapterOptions={chapterOptions}
                selectedChapter={selectedChapter}
                selectedChapterLabel={selectedChapterLabel}
                basedOnPDF={mcq.basedOnPDF}
                onChapterChange={setSelectedChapter}
                onGenerateNew={() => refetch.mcq()}
                isRefreshing={mcq.isLoading}
              />
            </div>
          </div>

          <div role="tabpanel" id="panel-keypoints" aria-labelledby="tab-keypoints" hidden={activeTab !== "keypoints"} tabIndex={0}>
            <KeyPoints
              data={keyPoints.data}
              isLoading={keyPoints.isLoading}
              basedOnPDF={keyPoints.basedOnPDF}
              selectedChapterLabel={selectedChapterLabel}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Powered by LangChain AI</span>
            <span>Cached for 48 hours</span>
          </div>
        </div>
      </div>
    </>
  )
}
