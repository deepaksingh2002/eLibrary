"use client"

interface Summary {
  overview: string
  keyThemes: string[]
  targetReader: string
  difficulty: string
  estimatedTime: string
}

interface Props {
  summary: Summary | null
  isLoading: boolean
  cached: boolean
}

export default function BookSummary({ summary, isLoading, cached }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
        <div className="h-4 bg-gray-200 rounded w-full mt-4" />
        <div className="space-y-2 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded-xl" />)}</div>
        <p className="text-center text-xs text-gray-400 mt-4 animate-pulse">✨ Gemini AI is analyzing this book...</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-3">📖</div>
        <p className="text-gray-500 text-sm">Could not generate summary. This book may need a description added by admin.</p>
      </div>
    )
  }

  const difficultyColorMap = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-yellow-100 text-yellow-700",
    Advanced: "bg-red-100 text-red-700"
  } as const

  const difficultyKey = (summary?.difficulty || "Intermediate") as keyof typeof difficultyColorMap
  const difficultyColor = difficultyColorMap[difficultyKey] || "bg-gray-100 text-gray-700"

  return (
    <div className="space-y-5">
      {cached && (<p className="text-xs text-gray-400 text-right">⚡ Cached response</p>)}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">📋 Overview</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{summary.overview}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">Difficulty</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColor}`}>{summary.difficulty}</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">Reading Time</p>
          <p className="text-sm font-semibold text-gray-800">⏱ {summary.estimatedTime}</p>
        </div>
      </div>

      {summary.keyThemes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">🎯 Key Themes</h3>
          <div className="space-y-2">
            {summary.keyThemes.map((theme, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-blue-50 rounded-xl px-3 py-2">
                <span className="text-blue-500 font-bold text-sm flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-blue-800">{theme}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.targetReader && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-700 mb-1">👤 Who Should Read This</p>
          <p className="text-sm text-purple-800">{summary.targetReader}</p>
        </div>
      )}
    </div>
  )
}
