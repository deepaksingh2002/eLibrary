"use client"

interface Summary {
  overview: string
  keyThemes: string[]
  targetReader: string
  difficulty: string
  estimatedTime: string
  basedOnPDF: boolean
}

interface Props {
  summary: Summary | null
  isLoading: boolean
  cached: boolean
  basedOnPDF: boolean
}

export default function BookSummary({
  summary,
  isLoading,
  cached,
  basedOnPDF,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-sm text-blue-500 animate-pulse">⏳</span>
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Reading the PDF with Gemini
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-700 dark:text-blue-200/80">
                The assistant is analyzing the uploaded PDF directly. Large books may take a moment.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 animate-pulse">
          <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-24 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">
          📭
        </div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Could not generate summary
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Make sure the book has a valid PDF uploaded.
        </p>
      </div>
    )
  }

  const diffColor = {
    Beginner: "bg-green-100 text-green-700 border-green-200",
    Intermediate: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Advanced: "bg-red-100 text-red-700 border-red-200",
  }[summary.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium ${basedOnPDF ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"}`}>
        <span>{basedOnPDF ? "✅" : "⚠️"}</span>
        <span>{basedOnPDF ? "Based on the uploaded PDF content" : "Based on book metadata only"}</span>
        {cached && <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700">⚡ Cached</span>}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Overview</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${diffColor}`}>{summary.difficulty}</span>
        </div>
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{summary.overview}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Difficulty</p>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{summary.difficulty}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Read time</p>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">⏱ {summary.estimatedTime}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:col-span-1 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Target reader</p>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{summary.targetReader || "General readers"}</p>
        </div>
      </div>

      {summary.keyThemes.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Key themes</h3>
            <span className="text-xs text-slate-400">{summary.keyThemes.length} items</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.keyThemes.map((theme, i) => (
              <span key={i} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.targetReader && (
        <div className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 shadow-sm dark:border-purple-500/20 dark:from-purple-500/10 dark:to-indigo-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-200">Who should read this</p>
          <p className="mt-2 text-sm leading-6 text-purple-900 dark:text-purple-100">{summary.targetReader}</p>
        </div>
      )}
    </div>
  )
}
