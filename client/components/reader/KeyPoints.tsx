"use client"
import { useState } from "react"
import { KeyPointsData } from "@/hooks/useAIStudy"

interface Props {
  data: KeyPointsData | null
  isLoading: boolean
  basedOnPDF: boolean
}

type Section = "chapters" | "glossary" | "takeaways" | "exam" | "interview"

export default function KeyPoints({ data, isLoading, basedOnPDF }: Props) {
  const [active, setActive] = useState<Section>("chapters")

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-700 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
          ⏳ Extracting key concepts from PDF content...
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">🗝️</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Could not extract key points. Please try again.
        </p>
      </div>
    )
  }

  const chapters = Array.isArray(data.chapters) ? data.chapters : []
  const takeaways = Array.isArray(data.takeaways) ? data.takeaways : []
  const examTips = Array.isArray(data.examTips) ? data.examTips : []
  const interviewTopics = Array.isArray(data.interviewTopics) ? data.interviewTopics : []
  const glossary = Array.isArray(data.glossary) ? data.glossary : []

  const tabs: { key: Section; icon: string; label: string }[] = [
    { key: "chapters", icon: "📖", label: "Chapters" },
    { key: "takeaways", icon: "💡", label: "Takeaways" },
    { key: "exam", icon: "📝", label: "Exam Tips" },
    { key: "interview", icon: "🎯", label: "Interview" },
    { key: "glossary", icon: "📚", label: "Glossary" },
  ]

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium ${basedOnPDF ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"}`}>
        <span>{basedOnPDF ? "✅" : "⚠️"}</span>
        <span>{basedOnPDF ? "Extracted from actual PDF content" : "Based on book metadata (PDF unavailable)"}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${active === t.key ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* CHAPTERS */}
      {active === "chapters" && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {chapters.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No chapter data available
            </p>
          ) : (
            chapters.map((ch, ci) => (
              <div key={ci} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
                    {ci + 1}
                  </span>
                  {ch.title}
                </h3>
                <ul className="space-y-1.5 ml-2">
                  {ch.points.map((pt, pi) => (
                    <li key={pi} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 flex-shrink-0 text-xs text-blue-400">
                        •
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAKEAWAYS */}
      {active === "takeaways" && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-1 text-xs text-slate-400">
            Practical insights from this book
          </p>
          {takeaways.map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <span className="flex-shrink-0 text-sm font-bold text-amber-500">
                {i + 1}
              </span>
              <p className="text-sm text-amber-900 dark:text-amber-50">{t}</p>
            </div>
          ))}
          {takeaways.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              No takeaways available
            </p>
          )}
        </div>
      )}

      {/* EXAM TIPS */}
      {active === "exam" && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="mb-1 text-xs font-semibold text-blue-800 dark:text-blue-100">
              📝 Exam Preparation Topics
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-200/80">
              These are the most important topics from this book
              that are likely to appear in exams and tests.
            </p>
          </div>
          {examTips.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No exam tips available for this book
            </p>
          ) : (
            examTips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-indigo-900 dark:text-indigo-50">{tip}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* INTERVIEW TOPICS */}
      {active === "interview" && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/10">
            <p className="mb-1 text-xs font-semibold text-green-800 dark:text-green-100">
              🎯 Job Interview Topics
            </p>
            <p className="text-xs text-green-700 dark:text-green-200/80">
              Key concepts from this book that interviewers commonly
              ask about in technical and academic job interviews.
            </p>
          </div>
          {interviewTopics.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No interview topics available for this book
            </p>
          ) : (
            interviewTopics.map((topic, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-emerald-900 dark:text-emerald-50">{topic}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* GLOSSARY */}
      {active === "glossary" && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-1 text-xs text-slate-400">
            {glossary.length} important terms from this book
          </p>
          {glossary.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No glossary terms found
            </p>
          ) : (
            glossary.map((g, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {g.term}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {g.definition}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
