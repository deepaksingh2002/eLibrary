"use client"
import { useState } from "react"

interface KeyPointsData {
  chapters: { title: string; points: string[] }[]
  glossary: { term: string; definition: string }[]
  takeaways: string[]
}

interface Props {
  data: KeyPointsData | null
  isLoading: boolean
}

export default function KeyPoints({ data, isLoading }: Props) {
  const [activeSection, setActiveSection] = useState<"chapters" | "glossary" | "takeaways">("chapters")

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
            <div className="h-3 bg-gray-100 rounded w-4/6" />
          </div>
        ))}
        <p className="text-center text-xs text-gray-400 mt-4 animate-pulse">✨ Extracting key concepts...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-3">🗝️</div>
        <p className="text-gray-500 text-sm">Could not extract key points for this book.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {([
          { key: "chapters", label: "📖 Chapters" },
          { key: "takeaways", label: "💡 Takeaways" },
          { key: "glossary", label: "📝 Glossary" }
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${activeSection === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === "chapters" && (
        <div className="space-y-4">
          {data.chapters.map((chapter, ci) => (
            <div key={ci}>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2"><span className="text-blue-500">◆</span>{chapter.title}</h3>
              <ul className="space-y-1.5 ml-4">
                {chapter.points.map((point, pi) => (
                  <li key={pi} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-blue-400 mt-1.5 text-xs flex-shrink-0">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeSection === "takeaways" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-3">5 actionable insights from this book</p>
          {data.takeaways.map((t, i) => (
            <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <span className="text-amber-500 font-bold text-sm flex-shrink-0">{i + 1}</span>
              <p className="text-sm text-amber-900">{t}</p>
            </div>
          ))}
        </div>
      )}

      {activeSection === "glossary" && (
        <div className="space-y-2">
          {data.glossary.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No glossary terms found for this book.</p>
          ) : (
            data.glossary.map((g, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800">{g.term}</p>
                <p className="text-xs text-gray-500 mt-0.5">{g.definition}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
