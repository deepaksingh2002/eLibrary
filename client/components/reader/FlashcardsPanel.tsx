"use client"

import { useCallback, useEffect, useState } from "react"

type Card = { front: string; back: string; evidence: string; difficulty: "easy" | "medium" | "hard" }

export default function FlashcardsPanel({ bookId, chapterId }: { bookId: string; chapterId: string }) {
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadDeck = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/flashcards/${bookId}/${chapterId}`, { credentials: "include" })
    if (response.ok) {
      const payload = await response.json()
      setCards(payload.deck?.cards || [])
    }
    setLoading(false)
  }, [bookId, chapterId])

  async function startDeck() {
    setLoading(true)
    await fetch("/api/flashcards", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, chapterId }),
    })
    await loadDeck()
  }

  useEffect(() => { void loadDeck() }, [loadDeck])

  const card = cards[index]
  if (loading) return <p>Loading flashcards...</p>
  if (!card) return <button onClick={() => void startDeck()}>Generate flashcards</button>

  return (
    <section>
      <button onClick={() => setFlipped((value) => !value)} aria-label="Flip flashcard">
        <strong>{flipped ? card.back : card.front}</strong>
      </button>
      <p>{index + 1} / {cards.length}</p>
      <button disabled={index === 0} onClick={() => { setIndex((value) => value - 1); setFlipped(false) }}>Previous</button>
      <button disabled={index === cards.length - 1} onClick={() => { setIndex((value) => value + 1); setFlipped(false) }}>Next</button>
      <button onClick={() => window.localStorage.setItem(`bad-card:${bookId}:${chapterId}:${index}`, "true")}>Bad card</button>
    </section>
  )
}
