"use client"

interface Card {
  question: string
  answer: string
}

interface Props {
  cards: Card[]
  isLoading: boolean
}

export default function Flashcards({ cards, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    )
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">🃏</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">No flashcards available for this book.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {cards.map((c, i) => (
        <div key={i} className="rounded-3xl border p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold">Q{i + 1}: {c.question}</div>
          <div className="text-sm text-slate-600">A: {c.answer}</div>
        </div>
      ))}
    </div>
  )
}
