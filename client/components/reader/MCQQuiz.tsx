"use client"
import { useState, useEffect } from "react"
import { MCQQuestion } from "../../hooks/useAIStudy"

interface Props {
  questions: MCQQuestion[]
  isLoading: boolean
  basedOnPDF: boolean
}

type Answers = Record<number, "A" | "B" | "C" | "D"> 

export default function MCQQuiz({ questions, isLoading, basedOnPDF }: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [submitted, setSubmitted] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [activeQ, setActiveQ] = useState<number | null>(null)

  useEffect(() => {
    setAnswers({})
    setSubmitted(false)
    setShowAll(false)
    setActiveQ(null)
  }, [questions])

  const displayCount = showAll ? questions.length : 5
  const answeredCount = Object.keys(answers).length
  const score = submitted ? questions.filter(q => answers[q.id] === q.correct).length : 0
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  function handleSelect(qId: number, opt: "A"|"B"|"C"|"D") {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: opt }))
  }

  function handleSubmit() {
    if (answeredCount < questions.length) return
    setSubmitted(true)
    setShowAll(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleRetake() {
    setAnswers({})
    setSubmitted(false)
    setShowAll(false)
    setActiveQ(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Generating questions from PDF...</p>
              <p className="text-xs text-blue-600 mt-0.5">AI is reading the actual book content. This takes 15–30 seconds.</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-blue-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4" /></div>
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="space-y-2">{[1,2,3,4].map(j => <div key={j} className="h-10 bg-gray-100 rounded-xl" />)}</div>
          </div>
        ))}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-700 font-semibold mb-2">No questions generated</p>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">The AI could not extract enough content from this PDF to generate reliable questions. This usually means the PDF is scanned or has very limited text.</p>
      </div>
    )
  }

  const scoreConfig = pct >= 80 ? { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", emoji: "🎉", msg: "Excellent work! You have a strong grasp of this material." } : pct >= 60 ? { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", emoji: "👍", msg: "Good effort! Review the highlighted answers to improve." } : { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", emoji: "📚", msg: "Keep studying! Check the explanations below to learn." }

  return (
    <div className="space-y-4">
      <div className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-2 ${basedOnPDF ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
        <span>{basedOnPDF ? "✅" : "⚠️"}</span>
        <span>{basedOnPDF ? `${questions.length} questions from actual PDF content` : "Questions based on book metadata — PDF not available"}</span>
      </div>

      {submitted && (
        <div className={`border-2 rounded-2xl p-5 text-center ${scoreConfig.bg} ${scoreConfig.border}`}>
          <div className="text-5xl mb-2">{scoreConfig.emoji}</div>
          <p className={`text-3xl font-bold ${scoreConfig.text} mb-1`}>{score}/{questions.length}</p>
          <p className={`text-lg font-semibold ${scoreConfig.text}`}>{pct}% Score</p>
          <p className="text-sm text-gray-600 mt-2 max-w-xs mx-auto">{scoreConfig.msg}</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">{[...new Set(questions.map(q => q.topic))].map(topic => {const topicQs = questions.filter(q => q.topic === topic); const topicScore = topicQs.filter(q => answers[q.id] === q.correct).length; const topicPct = Math.round((topicScore / topicQs.length) * 100); return (<span key={topic} className={`text-xs px-2.5 py-1 rounded-full font-medium ${topicPct >= 70 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{topic}: {topicScore}/{topicQs.length}</span>)})}</div>
          <button onClick={handleRetake} className="mt-4 bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">Retake Quiz</button>
        </div>
      )}

      {!submitted && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex justify-between text-xs text-gray-500 mb-2"><span>{answeredCount} of {questions.length} answered</span><span>{questions.length - answeredCount} remaining</span></div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
        </div>
      )}

      {questions.slice(0, displayCount).map((q, idx) => {
        const userAnswer = answers[q.id]
        const isCorrect = submitted && userAnswer === q.correct
        const isWrong = submitted && userAnswer && userAnswer !== q.correct
        const isExpanded = activeQ === q.id
        const cardBorder = isCorrect ? "border-green-200 bg-green-50" : isWrong ? "border-red-200 bg-red-50" : userAnswer && !submitted ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"

        return (
          <div key={q.id} className={`border rounded-2xl overflow-hidden ${cardBorder}`}>
            <div className="p-4 cursor-pointer" onClick={() => setActiveQ(isExpanded ? null : q.id)}>
              <div className="flex items-start gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? "bg-green-500 text-white" : isWrong ? "bg-red-500 text-white" : userAnswer ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>{isCorrect ? "✓" : isWrong ? "✗" : idx + 1}</span>
                <div className="flex-1"><p className="text-sm font-medium text-gray-800 leading-relaxed">{q.question}</p><span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{q.topic}</span></div>
                <span className={`text-gray-400 text-xs ${isExpanded ? "rotate-180" : ""}`}>▼</span>
              </div>
            </div>

            {(isExpanded || !userAnswer || submitted) && (
              <div className="px-4 pb-4 space-y-2">
                {(["A","B","C","D"] as const).map(opt => {
                  const isSelected = userAnswer === opt
                  const isTheCorrect = q.correct === opt
                  const optStyle = submitted ? isTheCorrect ? "border-green-400 bg-green-100 text-green-800" : isSelected && !isTheCorrect ? "border-red-400 bg-red-100 text-red-800" : "border-gray-200 bg-white text-gray-500" : isSelected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"

                  return (
                    <div key={opt} onClick={() => handleSelect(q.id, opt)} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 transition-all text-sm ${optStyle} ${submitted ? "" : "cursor-pointer"}`}>
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${submitted && isTheCorrect ? "border-green-500 bg-green-500 text-white" : submitted && isSelected && !isTheCorrect ? "border-red-500 bg-red-500 text-white" : isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-400"}`}>{submitted && isTheCorrect ? "✓" : submitted && isSelected && !isTheCorrect ? "✗" : opt}</span>
                      <span>{q.options[opt]}</span>
                    </div>
                  )
                })}

                {submitted && (
                  <div className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${isCorrect ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                    <span className="font-semibold">💡 Explanation: </span>{q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {!showAll && questions.length > 5 && !submitted && (
        <button onClick={() => setShowAll(true)} className="w-full py-3 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">Show all {questions.length} questions ↓</button>
      )}

      {!submitted && (
        <button onClick={handleSubmit} disabled={answeredCount < questions.length} className={`w-full py-3.5 rounded-xl font-semibold text-sm ${answeredCount === questions.length ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
          {answeredCount < questions.length ? `Answer all questions to submit (${answeredCount}/${questions.length})` : "Submit Quiz ✓"}
        </button>
      )}
    </div>
  )
}
