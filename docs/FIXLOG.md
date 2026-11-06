# Fix log

## Baseline

- Changed: Created branch `v2/ocr-and-ai-fixes`.
- Failed: Root `npm install` failed because the repository has no root `package.json`.
- Failed: `/server` install also hit an existing npm peer-dependency conflict (`@langchain/community`/`dotenv`); baseline lint could not run because dependencies were absent and baseline tests reported `jest: not found`.
- Changed: Installed dependencies with `--legacy-peer-deps`; baseline lint passed and baseline tests found no tests.
- Changed: Phase 1 now uses MuPDF for PDF page counting/rasterization, extracts native text per page, OCRs only low-quality pages, and reports OCR failures/warnings.
- Changed: Added queue worker entry point, stable job IDs/retries, optional cache TTL, production Redis guard, and AI error propagation.
- Changed: Added flashcard schemas/service/model/authenticated routes and a client flip-card panel; added BM25/RRF/no-op reranker helpers and retrieval scoping.
- Changed: Added MuPDF rasterization/native-text regression tests and search-quality tests.
- Failed: The requested full OCR fixture suite (real scanned/mixed PDFs and real Tesseract assertions), queue integration tests, flashcard route/model tests, and client API integration tests were not completed in this pass.
- Changed: Final server validation passed: `npm run lint`; `npm test` => 2 suites passed, 6 tests passed.
- Changed: Final client validation passed: `npm run lint` (existing MCQ warnings remain) and `npm run build`.
- Next: Review the remaining unverified acceptance checks before merging.
