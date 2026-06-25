import { detectChaptersFromPages } from "../src/rag/chapterDetection"

describe("detectChaptersFromPages", () => {
  it("prefers clean TOC titles over raw OCR chapter fragments", () => {
    const pages = [
      {
        pageNumber: 1,
        text: [
          "Contents",
          "Chapter 1 Binary Search ................................ 3",
          "Chapter 2 Sorting ...................................... 19",
        ].join("\n"),
      },
      {
        pageNumber: 3,
        text: "Chapter 1: talks about binary search and shows how an algorithm halves the search space.",
      },
      {
        pageNumber: 19,
        text: "Chapter 2: describes sorting and compares selection sort with insertion sort.",
      },
    ]

    const chapters = detectChaptersFromPages(pages)

    expect(chapters.length).toBeGreaterThanOrEqual(2)
    const chapterTitles = chapters.map((chapter) => chapter.chapter.toLowerCase())
    expect(chapterTitles).toEqual(
      expect.arrayContaining(["chapter 1: binary search", "chapter 2: sorting"]),
    )
    for (const chapter of chapters) {
      expect(chapter.chapter.toLowerCase()).not.toContain("talks about")
      expect(chapter.chapter.toLowerCase()).not.toContain("describes")
    }
  })
})