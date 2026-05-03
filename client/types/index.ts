export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "user" | "guest"
  avatar?: string
  preferences: { genres: string[]; language: string }
  streak: number
  monthlyGoal: number
  createdAt: string
}

export interface ReadingSession {
  _id: string
  startTime: string
  endTime?: string
  minutesRead: number
}

export interface Bookmark {
  _id: string
  page: number
  note: string
  createdAt: string
}

export interface ReadingProgress {
  _id: string
  userId: string
  bookId: string | Book
  progress: number
  status: "not-started" | "in-progress" | "completed"
  sessions: ReadingSession[]
  bookmarks: Bookmark[]
  lastRead: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardData {
  user: {
    name: string
    email: string
    avatar?: string
    streak: number
    longestStreak: number
    totalBooksRead: number
    totalMinutesRead: number
    monthlyGoal: number
    isActiveToday: boolean
  }
  continueReading: (ReadingProgress & { bookId: Book })[]
  recentlyCompleted: (ReadingProgress & { bookId: Book })[]
  goalProgress: {
    goal: number
    booksCompletedThisMonth: number
    percentage: number
    isGoalSet: boolean
  }
  recentActivity: {
    _id: string
    eventType: string
    bookId: Book
    createdAt: string
  }[]
  weeklyActivity: { date: string; sessions: number }[]
}

export interface UserStats {
  totalBooksRead: number
  totalMinutesRead: number
  totalHoursRead: number
  byStatus: {
    "not-started": number
    "in-progress": number
    "completed": number
  }
  favouriteGenre: string | null
  longestSessionMinutes: number
}

export interface Book {
  _id: string
  title: string
  author: string
  description: string
  genre: string
  language: string
  tags: string[]
  coverUrl?: string
  coverPublicId?: string
  pdfUrl: string
  pdfPublicId?: string
  status: "draft" | "published"
  downloads: number
  avgRating: number
  totalReviews: number
  uploadedBy: { _id: string; name: string }
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}

export interface PaginatedBooks {
  books: Book[]
  total: number
  page: number
  totalPages: number
}

export interface Review {
  _id: string
  bookId: string
  userId: {
    _id: string
    name: string
    avatar?: string
  }
  rating: number
  title?: string
  body?: string
  helpfulVotes: number
  voters: string[]
  isFlagged: boolean
  isRemoved: boolean
  createdAt: string
  updatedAt: string
}

export interface ReviewDistribution {
  distribution: { star: number; count: number }[]
  total: number
  average: number
}

export interface PaginatedReviews {
  reviews: Review[]
  total: number
  page: number
  totalPages: number
}

export interface SearchResult {
  books: Book[]
  total: number
  page: number
  totalPages: number
  query: string
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface AutocompleteSuggestion {
  _id: string
  title: string
  author: string
  coverUrl?: string
  genre: string
}

export interface AuthResponse {
  user: User
  accessToken: string
}

export interface ApiError {
  message: string
}

export interface Recommendation {
  book: Book
  score: number
  reason: "collaborative" | "cold-start" | "content-based"
}

export interface RecommendationsResponse {
  recommendations: Recommendation[]
  isColdStart: boolean
  computedAt: string | null
  total: number
}

export interface ExplanationResponse {
  explanation: string
  isAIGenerated: boolean
}

export interface KPIStats {
  totalBooks: number
  publishedBooks: number
  totalUsers: number
  newUsersThisMonth: number
  totalDownloads: number
  downloadsThisMonth: number
  averageRating: number
  totalReviews: number
}

export interface TrendPoint {
  date: string
  count: number
}

export interface GenreDistributionItem {
  genre: string
  count: number
  totalDownloads: number
  avgRating: number
}

export interface GrowthPoint {
  date: string
  newUsers: number
  cumulativeUsers: number
}

export interface AdminBook extends Book {
  uploadedBy: { _id: string; name: string; email: string }
}

export interface BulkImportResult {
  imported: number
  failed: number
  errors: { index: number; title: string; reason: string }[]
}
