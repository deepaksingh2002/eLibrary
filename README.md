# eLabrary

A full-stack digital library platform for discovering books, tracking reading progress, writing reviews, and using AI-assisted study tools.

## Overview

This repository contains two apps:

- `client/` - Next.js frontend
- `server/` - Express + MongoDB backend

Main features include:

- Book browsing, search, and detail pages
- Authentication and protected routes
- Reading progress tracking and streaks
- Reviews, ratings, bookmarks, and recommendations
- Admin tools for book management and imports
- AI study assistance and smart import workflows

## Project Structure

- `client/` - Next.js app router UI, components, hooks, and client state
- `server/` - API, database models, routes, services, jobs, and scripts
- `render.yaml` - Render deployment config for the backend

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- MongoDB connection string
- Cloudinary credentials for media uploads
- Gemini API key for AI features
- Redis is optional; when unavailable, AI jobs run inline instead of through a background worker

## Setup

### 1. Install dependencies

```bash
cd client
npm install

cd ../server
npm install
```

### 2. Configure environment variables

Create local env files from the examples provided:

- `client/.env.local`
- `server/.env`

Client example:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Server example:

```bash
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
REDIS_URL=redis://127.0.0.1:6379
PDF_OCR_DPI=220
PDF_OCR_LANG=eng
PDF_TEXT_MIN_WORDS=120
PDF_TEXT_MIN_PAGE_WORDS=18
```

If you do not want to run Redis locally, you can omit `REDIS_URL`. The server will still start and AI study jobs will execute inline.

### 3. Run the apps

Start the backend first:

```bash
cd server
npm run dev
```

Start the frontend in a separate terminal:

```bash
cd client
npm run dev
```

By default, the client runs on `http://localhost:3000` and the server runs on `http://localhost:5000`.

## Available Scripts

### Client

- `npm run dev` - start the Next.js dev server
- `npm run build` - build the frontend
- `npm run start` - start the production frontend
- `npm run lint` - run Next.js linting

### Server

- `npm run dev` - start the API in development mode
- `npm run build` - compile TypeScript
- `npm run start` - run the compiled server
- `npm run lint` - type-check without emitting files

## Deployment

The backend is configured for Render using `render.yaml`. Update the production environment variables in your hosting platform before deployment.

## Documentation

The repository now keeps the core project README only. Refer to the source code, environment examples, and deployment config in the `client/` and `server/` folders for setup details.

## AI Study - Flashcards API

Server endpoint: `GET /api/ai-study/:bookId/flashcards?count=8`

- Auth: Protected (must include `Authorization: Bearer <token>`)
- Returns JSON: `{ flashcards: [{ question, answer }], total, cached }`
- Cached: responses cached for 24 hours in `AIStudyCache`.

Client: the `AIStudyPanel` exposes a new "Flashcards" tab which calls the API when opened. The client hook is `useAIStudy(bookId)` and returns `flashcards` under the `flashcards` key.

Example curl (replace host, token, and book id):

```bash
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:5000/api/ai-study/<BOOK_ID>/flashcards?count=8"
```
