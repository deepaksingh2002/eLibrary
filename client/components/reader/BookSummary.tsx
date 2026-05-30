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
}

export default function BookSummary({
  summary,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-24 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800" />
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

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overview</p>
        <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
          {summary.overview}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From the author</p>
            <blockquote className="mt-2 rounded-lg border-l-4 border-indigo-500/80 bg-indigo-50/40 p-4 text-sm leading-7 text-slate-800 dark:border-indigo-400/60 dark:bg-slate-900/40 dark:text-slate-200">
              <p className="italic">{summary.targetReader || "A concise, persuasive note from the author explaining who benefits most from this book and what concrete gains a reader will get."}</p>
            </blockquote>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What you will learn</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
            {summary.keyThemes.length > 0 ? summary.keyThemes.slice(0, 4).map((theme, index) => (
              <li key={`${theme}-${index}`} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span>{theme}</span>
              </li>
            )) : (
              <li className="text-slate-500 dark:text-slate-400">The core ideas and lessons covered in the PDF.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Summary note removed per user request */}
    </div>
  )
}
