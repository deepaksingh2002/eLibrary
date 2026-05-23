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
      <div className="space-y-4 animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
            {['A','B','C','D'].map(o => (
              <div key={o} className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">❓</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Could not generate questions for this book. Make sure the book has a description.</p>
      </div>
    )
  }

  const scoreColor = percent >= 80 ? "text-green-600" : percent >= 60 ? "text-yellow-600" : "text-red-600"
  const scoreBg = percent >= 80 ? "bg-green-50 border-green-200" : percent >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
  const scoreEmoji = percent >= 80 ? "🎉" : percent >= 60 ? "👍" : "📚"

  return (
    <div id="mcq-top" className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quiz mode</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Practice with AI-generated questions</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Answer all questions, then submit to see your score and explanations.</p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right text-xs dark:bg-blue-500/10">
            <div className="font-semibold text-blue-700 dark:text-blue-200">{questions.length} questions</div>
            <div className="text-blue-500 dark:text-blue-300/80">LangChain generated</div>
          </div>
        </div>
      </div>

      {submitted && (
        <div className={`rounded-3xl border p-5 text-center shadow-sm ${scoreBg}`}>
          <div className="mb-2 text-4xl">{scoreEmoji}</div>
          <p className={`text-3xl font-bold ${scoreColor}`}>
            {score} / {questions.length}
          </p>
          <p className={`mt-1 text-sm font-semibold ${scoreColor}`}>{percent}% Score</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-600">
            {percent >= 80 ? "Excellent! You know this book well." : percent >= 60 ? "Good job! Review the highlighted answers." : "Keep reading! Check the explanations below."}
          </p>
          <button
            onClick={handleReset}
            className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Retake Quiz
          </button>
        </div>
      )}

      {!submitted && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>{Object.keys(answers).length} of {questions.length} answered</span>
            <span>{questions.length - Object.keys(answers).length} remaining</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300" style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }} />
          </div>
        </div>
      )}

      {questions.slice(0, displayCount).map((q, idx) => {
        const userAnswer = answers[q.id]
        const isCorrect = submitted && userAnswer === q.correct
        const isWrong = submitted && userAnswer && userAnswer !== q.correct

        return (
          <div key={q.id} className={`rounded-3xl border p-4 transition-all shadow-sm ${submitted && isCorrect ? "border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10" : submitted && isWrong ? "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Q{idx + 1}
              </span>
              <p className="text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">{q.question}</p>
            </div>

            <div className="space-y-2">
              {(["A","B","C","D"] as const).map(opt => {
                const isSelected = userAnswer === opt
                const isTheCorrect = q.correct === opt
                const optionClass = submitted ? isTheCorrect ? "border-green-400 bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-50" : isSelected && !isTheCorrect ? "border-red-400 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-50" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400" : isSelected ? "border-blue-400 bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-50" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(q.id, opt)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition-all ${optionClass}`}
                  >
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${submitted && isTheCorrect ? "border-green-500 bg-green-500 text-white" : submitted && isSelected && !isTheCorrect ? "border-red-500 bg-red-500 text-white" : isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-slate-400 dark:border-slate-700"}`}>
                      {submitted && isTheCorrect ? "✓" : submitted && isSelected && !isTheCorrect ? "✗" : opt}
                    </span>
                    <span className="leading-6">{q.options[opt]}</span>
                  </button>
                )
              })}
            </div>

            {submitted && q.explanation && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-xs leading-6 text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-700 dark:text-slate-200">💡 Explanation: </span>{q.explanation}</p>
              </div>
            )}
          </div>
        )
      })}

      {!showAll && questions.length > 5 && !submitted && (
        <button onClick={() => setShowAll(true)} className="w-full rounded-full border border-slate-200 bg-white py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
          Show all {questions.length} questions ↓
        </button>
      )}

      {!submitted && (
        <button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
          {Object.keys(answers).length < questions.length ? `Answer all questions (${Object.keys(answers).length}/${questions.length})` : "Submit Quiz ✓"}
        </button>
      )}
    </div>
  )
}
