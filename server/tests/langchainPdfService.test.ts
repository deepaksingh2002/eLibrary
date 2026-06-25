import { _testable } from '../src/services/langchainPdfService'

describe('verifyMCQAnswers', () => {
  const source = `An algorithm is a set of instructions for accomplishing a task. Breadth-first search is used to calculate the shortest path for an unweighted graph. Dynamic programming only works when each subproblem is discrete.`

  test('accepts well-grounded question', () => {
    const questions = [
      {
        question: 'What is breadth-first search used for?',
        options: {
          A: 'To calculate the shortest path for an unweighted graph',
          B: 'To sort numbers',
          C: 'To compress images',
          D: 'To encrypt data',
        },
        correct: 'A',
        explanation: 'Breadth-first search is used to calculate the shortest path for an unweighted graph.',
        topic: 'graphs',
      },
    ]

    const verified = _testable.verifyMCQAnswers(questions, source)
    expect(verified.length).toBe(1)
    expect(verified[0].question).toContain('breadth-first')
  })

  test('rejects poorly grounded question', () => {
    const questions = [
      {
        question: 'Which is the best color for a car?',
        options: {
          A: 'Blue',
          B: 'Green',
          C: 'Red',
          D: 'Yellow',
        },
        correct: 'A',
        explanation: 'Blue looks nice.',
        topic: 'color',
      },
    ]

    const verified = _testable.verifyMCQAnswers(questions, source)
    expect(verified.length).toBe(0)
  })
})

describe('compactMCQText', () => {
  test('preserves full answer text without truncation', () => {
    const text = 'According to the passage, binary search halves the search space at each step until the target is found or the interval becomes empty.'
    const compacted = _testable.compactMCQText(text)

    expect(compacted).toContain('binary search halves the search space')
    expect(compacted).not.toContain('…')
    expect(compacted).not.toContain('...')
  })
})
