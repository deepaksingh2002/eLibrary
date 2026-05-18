"use client"
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
    { key: "keypoints", icon: "🗝️", label: "Key Points" }
  ]

  return (
    <>
      <button onClick={openPanel} className="fixed bottom-6 right-6 z-40 bg-purple-600 text-white px-4 py-3 rounded-2xl shadow-lg shadow-purple-200 flex items-center gap-2 hover:bg-purple-700 hover:shadow-purple-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 font-medium text-sm">
        <span className="text-base">✨</span>
        AI Study
      </button>

      {isOpen && <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={closePanel} />}

      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="bg-purple-600 px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">✨ AI Study Assistant</h2>
              <p className="text-purple-200 text-xs mt-0.5 line-clamp-1">{bookTitle}</p>
            </div>
            <button onClick={closePanel} className="text-purple-200 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-purple-500 transition-colors text-xl font-light">×</button>
          </div>

          <div className="flex gap-1 mt-4">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeTab === tab.key ? "bg-white text-purple-700" : "text-purple-200 hover:bg-purple-500"}`}>
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex-shrink-0">
          <p className="text-xs text-amber-700"><span className="font-semibold">ℹ️ AI Generated:</span> Content is based on book metadata and may not cover all topics. Use as a study aid only.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "summary" && <BookSummary summary={summary.data} isLoading={summary.isLoading} cached={summary.cached} />}

          {activeTab === "mcq" && (
            <div>
              {!mcq.isLoading && mcq.questions.length === 0 && !mcq.cached && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800"><span className="font-semibold">📌 Note:</span> Generating 10 questions using Gemini AI. This may take a few seconds...</div>
              )}
              <MCQQuiz questions={mcq.questions} isLoading={mcq.isLoading} />
            </div>
          )}

          {activeTab === "keypoints" && <KeyPoints data={keyPoints.data} isLoading={keyPoints.isLoading} />}
        </div>

        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Powered by Google Gemini AI • Results cached for 24 hours</p>
        </div>
      </div>
    </>
  )
}
