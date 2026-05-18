"use client"
import { useState } from "react"
import { MCQQuestion } from "../../hooks/useAIStudy"

interface Props {
  questions: MCQQuestion[]
  isLoading: boolean
}

type UserAnswers = Record<number, "A" | "B" | "C" | "D"> 

export default function MCQQuiz({ questions, isLoading }: Props) {
  const [answers, setAnswers] = useState<UserAnswers>({})
  const [submitted, setSubmitted] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const displayCount = showAll ? questions.length : 5

  const score = submitted
    ? questions.filter(q => answers[q.id] === q.correct).length
    : 0
  const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  const handleSelect = (qId: number, option: "A" | "B" | "C" | "D") => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: option }))
  }

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      alert(`Please answer all ${questions.length} questions first`)
      return
    }
    setSubmitted(true)
    setShowAll(true)
    document.getElementById("mcq-top")?.scrollIntoView({ behavior: "smooth" })
  }

  const handleReset = () => {
    setAnswers({})
    setSubmitted(false)
    setShowAll(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            {['A','B','C','D'].map(o => (
              <div key={o} className="h-9 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-4xl mb-3">❓</div>
        <p className="text-gray-500 text-sm">Could not generate questions for this book. Make sure the book has a description.</p>
      </div>
    )
  }

  const scoreColor = percent >= 80 ? "text-green-600" : percent >= 60 ? "text-yellow-600" : "text-red-600"
  const scoreBg = percent >= 80 ? "bg-green-50 border-green-200" : percent >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
  const scoreEmoji = percent >= 80 ? "🎉" : percent >= 60 ? "👍" : "📚"

  return (
    <div id="mcq-top" className="space-y-4">
      {submitted && (
        <div className={`border rounded-2xl p-4 text-center ${scoreBg}`}>
          <div className="text-4xl mb-2">{scoreEmoji}</div>
          <p className={`text-2xl font-bold ${scoreColor}`}>{score} / {questions.length}</p>
          <p className={`text-sm font-medium ${scoreColor}`}>{percent}% Score</p>
          <p className="text-xs text-gray-500 mt-1">{percent >= 80 ? "Excellent! You know this book well." : percent >= 60 ? "Good job! Review the highlighted answers." : "Keep reading! Check the explanations below."}</p>
          <button onClick={handleReset} className="mt-3 text-xs bg-white border border-gray-200 px-4 py-1.5 rounded-full text-gray-600 hover:bg-gray-50 transition-colors">Retake Quiz</button>
        </div>
      )}

      {!submitted && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{Object.keys(answers).length} of {questions.length} answered</span>
            <span>{questions.length - Object.keys(answers).length} remaining</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }} />
          </div>
        </div>
      )}

      {questions.slice(0, displayCount).map((q, idx) => {
        const userAnswer = answers[q.id]
        const isCorrect = submitted && userAnswer === q.correct
        const isWrong = submitted && userAnswer && userAnswer !== q.correct

        return (
          <div key={q.id} className={`border rounded-xl p-4 transition-all ${submitted && isCorrect ? "border-green-200 bg-green-50" : submitted && isWrong ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"}`}>
            <p className="text-sm font-medium text-gray-800 mb-3"><span className="text-gray-400 mr-2">Q{idx + 1}.</span>{q.question}</p>

            <div className="space-y-2">
              {(["A","B","C","D"] as const).map(opt => {
                const isSelected = userAnswer === opt
                const isTheCorrect = q.correct === opt
                const optionClass = submitted ? isTheCorrect ? "bg-green-100 border-green-400 text-green-800" : isSelected && !isTheCorrect ? "bg-red-100 border-red-400 text-red-800" : "bg-gray-50 border-gray-200 text-gray-500" : isSelected ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 cursor-pointer"

                return (
                  <div key={opt} onClick={() => handleSelect(q.id, opt)} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 text-sm transition-all ${optionClass}`}>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${submitted && isTheCorrect ? "border-green-500 bg-green-500 text-white" : submitted && isSelected && !isTheCorrect ? "border-red-500 bg-red-500 text-white" : isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-400"}`}>
                      {submitted && isTheCorrect ? "✓" : submitted && isSelected && !isTheCorrect ? "✗" : opt}
                    </span>
                    <span>{q.options[opt]}</span>
                  </div>
                )
              })}
            </div>

            {submitted && q.explanation && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">💡 Explanation: </span>{q.explanation}</p>
              </div>
            )}
          </div>
        )
      })}

      {!showAll && questions.length > 5 && !submitted && (
        <button onClick={() => setShowAll(true)} className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium">Show all {questions.length} questions ↓</button>
      )}

      {!submitted && (
        <button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {Object.keys(answers).length < questions.length ? `Answer all questions (${Object.keys(answers).length}/${questions.length})` : "Submit Quiz ✓"}
        </button>
      )}
    </div>
  )
}
