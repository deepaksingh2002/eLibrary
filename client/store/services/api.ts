import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from "@reduxjs/toolkit/query/react";
import { useAuthStore } from "../../store/authStore";
import type {
  AuthResponse,
  Book,
  Bookmark,
  BulkImportResult,
  PaginatedBooks,
  PaginatedReviews,
  RecommendationsResponse,
  ReadingProgress,
  ReadingSession,
  ReviewDistribution,
  AdminBook,
  User,
} from "../../types";

const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Generic response type for API responses with explicit payload contracts.
type ApiResponse<T = unknown> = T;

interface RefreshResponse {
  accessToken: string;
}

interface ReadingProgressSnapshot {
  _id?: string;
  userId?: string;
  bookId?: string | Book;
  progress: number;
  status: "not-started" | "in-progress" | "completed";
  sessions: ReadingSession[];
  bookmarks: Bookmark[];
  lastRead: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ReadingProgressResponse {
  progress: ReadingProgressSnapshot;
}

interface DownloadBookResponse {
  downloadUrl?: string;
  fileName?: string;
}

interface MessageResponse {
  message: string;
}

interface AdminBookListItem {
  _id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  coverUrl?: string;
  pdfUrl: string;
  status: "published" | "draft";
  downloads: number;
  avgRating: number;
  totalReviews: number;
  extractionStatus?: "pending" | "uploading" | "ready" | "failed" | "no_pdf";
  extractionPages?: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUserListItem {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  avatar?: string;
  totalBooksRead: number;
  streak: number;
  createdAt: string;
}

interface FlaggedReviewListItem {
  _id: string;
  title?: string;
  body?: string;
  rating: number;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  bookId: {
    _id: string;
    title: string;
    author: string;
  };
  flagCount: number;
  flaggedAt: string;
  createdAt: string;
}

interface DashboardUserSummary {
  name: string;
  email: string;
  avatar?: string;
  streak: number;
  longestStreak?: number;
  totalBooksRead: number;
  totalMinutesRead?: number;
  monthlyGoal: number;
  isActiveToday?: boolean;
}

interface GoalProgressSummary {
  current?: number;
  target?: number;
  progress?: number;
  [key: string]: unknown;
}

interface UserActivityItem {
  _id?: string;
  eventType?: string;
  createdAt?: string;
  bookId?: Book;
  [key: string]: unknown;
}

interface WeeklyActivityPoint {
  date: string;
  sessions: number;
}

interface AdminBooksResponse {
  books: AdminBookListItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface AdminUsersResponse {
  users: AdminUserListItem[];
  total?: number;
  totalPages: number;
  currentPage?: number;
}

interface FlaggedReviewsResponse {
  reviews: FlaggedReviewListItem[];
  totalPages: number;
  total?: number;
  currentPage?: number;
}

interface DashboardResponse {
  user: DashboardUserSummary;
  continueReading: Array<ReadingProgress & { bookId: Book }>;
  recentlyCompleted: Array<ReadingProgress & { bookId: Book }>;
  goalProgress: GoalProgressSummary;
  recentActivity: UserActivityItem[];
  weeklyActivity: WeeklyActivityPoint[];
}

interface AvatarResponse {
  avatar: string;
}

interface BookSummaryResponse {
  bookId?: string;
  title?: string;
  summary?: string;
  explanation?: string;
  summary_content?: string;
  content?: string;
  keyPoints?: string[];
  key_points?: string[];
  provider?: string;
  cached?: boolean;
  cachedAt?: string;
  generatedAt?: string;
}

interface BookExplanationResponse {
  explanation?: string;
  isAIGenerated?: boolean;
  provider?: string;
}

interface StudySummary {
  overview: string;
  keyThemes: string[];
  targetReader: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
}

interface AiStudySummaryResponse {
  summary?: StudySummary;
  cached?: boolean;
  cachedAt?: string;
  basedOnPDF?: boolean;
}

interface AiStudyMcqResponse {
  questions?: Array<{
    id: number;
    question: string;
    options: { A: string; B: string; C: string; D: string };
    correct: "A" | "B" | "C" | "D";
    explanation: string;
  }>;
  total?: number;
  cached?: boolean;
  basedOnPDF?: boolean;
}

interface StudyKeyPoints {
  chapters: Array<{ title: string; points: string[] }>;
  glossary: Array<{ term: string; definition: string }>;
  takeaways: string[];
}

interface AiStudyKeyPointsResponse {
  keyPoints?: StudyKeyPoints;
  cached?: boolean;
  basedOnPDF?: boolean;
}

interface SimilarBooksResponse {
  similar: Array<{ book: Book; score: number }>;
}

interface SmartImportBook {
  externalId: string;
  source: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  language: string;
  tags: string[];
  coverUrl: string;
  pdfUrl: string;
  previewUrl: string;
  pageCount: number;
  publishedYear: string;
  publisher: string;
  isbn: string;
  aiEnhanced: boolean;
  alreadyExists: boolean;
}

interface SmartSearchResponse {
  results: SmartImportBook[];
  total: number;
  query: string;
}

interface AddSmartBookPayload extends Omit<SmartImportBook, "alreadyExists"> {
  status?: "draft" | "published";
}

interface AddSmartBookResponse {
  message: string;
  book: Book;
  hasPdf: boolean;
  needsPdf: boolean;
  editUrl: string;
}

interface UserProfileResponse {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role?: User["role"];
  preferences?: User["preferences"];
  streak?: number;
  monthlyGoal?: number;
}

interface PreferencesResponse {
  genres: string[];
  language: string;
}

interface BulkImportBookInput {
  title: string;
  author: string;
  genre: string;
  description?: string;
  language?: string;
  tags?: string[];
  pdfUrl: string;
  coverUrl?: string;
  status?: "published" | "draft";
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: "include",
  prepareHeaders: (headers) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
  async (args, api, extraOptions) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 401 && useAuthStore.getState().accessToken) {
      const refreshResult = await rawBaseQuery(
        { url: "/api/auth/refresh", method: "POST" },
        api,
        extraOptions
      );

      const refreshData = refreshResult.data as RefreshResponse | undefined;
      const accessToken = typeof refreshData?.accessToken === "string" ? refreshData.accessToken : null;

      if (accessToken) {
        useAuthStore.getState().updateToken(accessToken);
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        useAuthStore.getState().logout();
      }
    }

    return result;
  };

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Books", "Book", "Dashboard", "Reviews", "Progress", "Recommendations", "Admin", "User"],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: "/api/auth/login", method: "POST", body }),
    }),
    register: builder.mutation<AuthResponse, { name: string; email: string; password: string }>({
      query: (body) => ({ url: "/api/auth/register", method: "POST", body }),
    }),
    forgotPassword: builder.mutation<ApiResponse<MessageResponse>, { email: string }>({
      query: (body) => ({ url: "/api/auth/forgot-password", method: "POST", body }),
    }),
    resetPassword: builder.mutation<ApiResponse<MessageResponse>, { token: string; newPassword: string }>({
      query: (body) => ({ url: "/api/auth/reset-password", method: "POST", body }),
    }),
    logout: builder.mutation<ApiResponse<MessageResponse>, void>({
      query: () => ({ url: "/api/auth/logout", method: "POST" }),
    }),
    logoutAll: builder.mutation<ApiResponse<MessageResponse>, void>({
      query: () => ({ url: "/api/auth/logout-all", method: "POST" }),
    }),

    getBooks: builder.query<PaginatedBooks, { page?: number; limit?: number; status?: string }>({
      query: ({ page = 1, limit = 12, status = "published" } = {}) =>
        `/api/books?page=${page}&limit=${limit}&status=${status}`,
      providesTags: ["Books"],
    }),
    getBook: builder.query<{ book: Book }, string>({
      query: (bookId) => `/api/books/${bookId}`,
      providesTags: (_result, _error, bookId) => [{ type: "Book", id: bookId }],
    }),
    searchBooks: builder.query<ApiResponse<PaginatedBooks>, { q?: string; genre?: string; language?: string; sort?: string; page?: number; limit?: number }>({
      query: ({ q = "", genre = "", language = "", sort = "newest", page = 1, limit = 12 }) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (genre) params.set("genre", genre);
        if (language) params.set("language", language);
        if (sort) params.set("sort", sort);
        params.set("page", String(page));
        params.set("limit", String(limit));
        return `/api/books/search?${params.toString()}`;
      },
    }),
    autocompleteBooks: builder.query<ApiResponse<Record<string, unknown>>, string>({
      query: (q) => `/api/books/autocomplete?q=${encodeURIComponent(q)}`,
    }),

    getDashboard: builder.query<DashboardResponse, void>({
      query: () => "/api/users/me/dashboard",
      providesTags: ["Dashboard"],
    }),
    getUserStats: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/users/me/stats",
    }),
    updateGoal: builder.mutation<ApiResponse<MessageResponse>, { monthlyGoal: number }>({
      query: (body) => ({ url: "/api/users/me/goal", method: "PATCH", body }),
      invalidatesTags: ["Dashboard"],
    }),
    updateProfile: builder.mutation<UserProfileResponse, { name: string }>({
      query: (body) => ({ url: "/api/users/me/profile", method: "PATCH", body }),
      invalidatesTags: ["Dashboard", "User"],
    }),
    updatePreferences: builder.mutation<PreferencesResponse, { genres: string[]; language: string }>({
      query: (body) => ({ url: "/api/users/me/preferences", method: "PATCH", body }),
      invalidatesTags: ["User"],
    }),
    updateAvatar: builder.mutation<AvatarResponse, FormData>({
      query: (body) => ({ url: "/api/users/me/avatar", method: "PATCH", body }),
      invalidatesTags: ["User"],
    }),

    getAdminKpis: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/admin/stats/kpis",
      providesTags: ["Admin"],
    }),
    getAdminTrend: builder.query<ApiResponse<Record<string, unknown>>, string>({
      query: (period) => `/api/admin/stats/downloads-trend?period=${period}`,
    }),
    getAdminTopBooks: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/admin/stats/top-books?limit=10&metric=downloads",
    }),
    getAdminGenres: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/admin/stats/genre-distribution",
    }),
    getAdminUserGrowth: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/admin/stats/user-growth?period=12m",
    }),
    getAdminUsers: builder.query<AdminUsersResponse, { page: number; search?: string; role?: string; sort?: string }>({
      query: ({ page, search = "", role = "", sort = "newest" }) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (search) params.set("search", search);
        if (role) params.set("role", role);
        if (sort) params.set("sort", sort);
        return `/api/admin/users?${params.toString()}`;
      },
    }),
    updateAdminUserRole: builder.mutation<ApiResponse<MessageResponse>, { id: string; role: string }>({
      query: ({ id, role }) => ({ url: `/api/admin/users/${id}/role`, method: "PATCH", body: { role } }),
    }),
    deleteAdminUser: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (id) => ({ url: `/api/admin/users/${id}`, method: "DELETE" }),
    }),
    getFlaggedReviews: builder.query<FlaggedReviewsResponse, number>({
      query: (page) => `/api/reviews/flagged?page=${page}&limit=20`,
    }),
    moderateReview: builder.mutation<ApiResponse<MessageResponse>, { reviewId: string; action: "unflag" | "remove" }>({
      query: ({ reviewId, action }) => ({ url: `/api/reviews/${reviewId}/flag`, method: "PATCH", body: { action } }),
    }),
    getAdminBooks: builder.query<AdminBooksResponse, { page: number; search?: string; status?: string }>({
      query: ({ page, search = "", status = "all" }) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (search) params.set("search", search);
        if (status !== "all") params.set("status", status);
        return `/api/admin/books?${params.toString()}`;
      },
    }),
    clearAiStudyCache: builder.mutation<ApiResponse<{ message: string }>, string>({
      query: (bookId) => ({ url: `/api/ai-study/${bookId}/cache`, method: "DELETE" }),
      invalidatesTags: (_result, _error, bookId) => [{ type: "Book", id: bookId }, "Admin", "Books"],
    }),
    toggleBookStatus: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (bookId) => ({ url: `/api/books/${bookId}/toggle-status`, method: "PATCH" }),
    }),
    deleteBook: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (bookId) => ({ url: `/api/books/${bookId}`, method: "DELETE" }),
    }),
    bulkImportBooks: builder.mutation<BulkImportResult, BulkImportBookInput[]>({
      query: (books) => ({ url: "/api/admin/books/bulk-import", method: "POST", body: { books } }),
      invalidatesTags: ["Books", "Admin"],
    }),


    getRecommendations: builder.query<RecommendationsResponse, void>({
      query: () => "/api/recommendations",
      providesTags: ["Recommendations"],
    }),
    refreshRecommendations: builder.mutation<ApiResponse<MessageResponse>, void>({
      query: () => ({ url: "/api/recommendations/refresh", method: "POST" }),
      invalidatesTags: ["Recommendations"],
    }),
    getSimilarBooks: builder.query<SimilarBooksResponse, string>({
      query: (bookId) => `/api/recommendations/similar/${bookId}`,
    }),
    getBookExplanation: builder.query<BookExplanationResponse, string>({
      query: (bookId) => `/api/recommendations/${bookId}/explain`,
    }),
    getBookSummary: builder.query<BookSummaryResponse, string>({
      query: (bookId) => `/api/books/${bookId}/summary`,
    }),
    getAiStudySummary: builder.query<AiStudySummaryResponse, string>({
      query: (bookId) => `/api/ai-study/${bookId}/summary`,
    }),
    getAiStudyMcq: builder.query<AiStudyMcqResponse, string>({
      query: (bookId) => `/api/ai-study/${bookId}/mcq?count=10`,
    }),
    getAiStudyKeyPoints: builder.query<AiStudyKeyPointsResponse, string>({
      query: (bookId) => `/api/ai-study/${bookId}/key-points`,
    }),
    getReadingProgress: builder.query<ReadingProgressSnapshot, string>({
      query: (bookId) => `/api/progress/${bookId}`,
      transformResponse: (response: ReadingProgressResponse) => response.progress,
      providesTags: (_result, _error, bookId) => [{ type: "Progress", id: bookId }],
    }),
    updateReadingProgress: builder.mutation<ReadingProgressResponse, { bookId: string; body: { progress: number; sessionMinutes: number } }>({
      query: ({ bookId, body }) => ({ url: `/api/progress/${bookId}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { bookId }) => [{ type: "Progress", id: bookId }, "Dashboard"],
    }),
    addBookmark: builder.mutation<ApiResponse<Record<string, unknown>>, { bookId: string; page: number; note?: string }>({
      query: ({ bookId, page, note }) => ({
        url: `/api/progress/${bookId}/bookmarks`,
        method: "POST",
        body: { page, note },
      }),
      invalidatesTags: (_result, _error, { bookId }) => [{ type: "Progress", id: bookId }],
    }),
    editBookmark: builder.mutation<MessageResponse, { bookId: string; bookmarkId: string; note: string }>({
      query: ({ bookId, bookmarkId, note }) => ({
        url: `/api/progress/${bookId}/bookmarks/${bookmarkId}`,
        method: "PATCH",
        body: { note },
      }),
      invalidatesTags: (_result, _error, { bookId }) => [{ type: "Progress", id: bookId }],
    }),
    removeBookmark: builder.mutation<MessageResponse, { bookId: string; bookmarkId: string }>({
      query: ({ bookId, bookmarkId }) => ({
        url: `/api/progress/${bookId}/bookmarks/${bookmarkId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { bookId }) => [{ type: "Progress", id: bookId }],
    }),

    createBook: builder.mutation<ApiResponse<Record<string, unknown>>, FormData>({
      query: (body) => ({ url: "/api/books", method: "POST", body }),
      invalidatesTags: ["Books", "Admin"],
    }),
    updateBook: builder.mutation<ApiResponse<Record<string, unknown>>, { bookId: string; body: FormData }>({
      query: ({ bookId, body }) => ({ url: `/api/books/${bookId}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { bookId }) => [{ type: "Book", id: bookId }, "Books", "Admin"],
    }),
    searchSmartBooks: builder.query<SmartSearchResponse, { q: string; limit?: number }>({
      query: ({ q, limit = 12 }) => `/api/admin/smart-import/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    }),
    addSmartBook: builder.mutation<AddSmartBookResponse, AddSmartBookPayload>({
      query: (body) => ({ url: "/api/admin/smart-import/add", method: "POST", body }),
      invalidatesTags: ["Books", "Admin"],
    }),

    createReview: builder.mutation<ApiResponse<Record<string, unknown>>, Record<string, unknown>>({
      query: (body) => ({ url: "/api/reviews", method: "POST", body }),
      invalidatesTags: ["Reviews"],
    }),
    helpfulReview: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (reviewId) => ({ url: `/api/reviews/${reviewId}/helpful`, method: "POST" }),
      invalidatesTags: ["Reviews"],
    }),
    updateReview: builder.mutation<ApiResponse<Record<string, unknown>>, { reviewId: string; body: Record<string, unknown> }>({
      query: ({ reviewId, body }) => ({ url: `/api/reviews/${reviewId}`, method: "PATCH", body }),
      invalidatesTags: ["Reviews"],
    }),
    deleteReview: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (reviewId) => ({ url: `/api/reviews/${reviewId}`, method: "DELETE" }),
      invalidatesTags: ["Reviews"],
    }),
    flagReviewRemove: builder.mutation<ApiResponse<MessageResponse>, string>({
      query: (reviewId) => ({ url: `/api/reviews/${reviewId}/flag`, method: "PATCH", body: { action: "remove" } }),
      invalidatesTags: ["Reviews"],
    }),
    getBookReviews: builder.query<PaginatedReviews, { bookId: string; page: number; sort: string }>({
      query: ({ bookId, page, sort }) => `/api/reviews/book/${bookId}?page=${page}&sort=${sort}&limit=10`,
      providesTags: ["Reviews"],
    }),
    getReviewDistribution: builder.query<ReviewDistribution, string>({
      query: (bookId) => `/api/reviews/book/${bookId}/distribution`,
    }),
    getMyReviews: builder.query<ApiResponse<Record<string, unknown>>, void>({
      query: () => "/api/reviews/my",
      providesTags: ["Reviews"],
    }),
    downloadBook: builder.mutation<DownloadBookResponse, string>({
      query: (bookId) => ({ url: `/api/books/${bookId}/download`, method: "POST" }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useGetBooksQuery,
  useGetBookQuery,
  useSearchBooksQuery,
  useAutocompleteBooksQuery,
  useGetDashboardQuery,
  useGetUserStatsQuery,
  useUpdateGoalMutation,
  useUpdateProfileMutation,
  useUpdatePreferencesMutation,
  useUpdateAvatarMutation,
  useGetAdminKpisQuery,
  useGetAdminTrendQuery,
  useGetAdminTopBooksQuery,
  useGetAdminGenresQuery,
  useGetAdminUserGrowthQuery,
  useGetAdminUsersQuery,
  useUpdateAdminUserRoleMutation,
  useDeleteAdminUserMutation,
  useGetFlaggedReviewsQuery,
  useModerateReviewMutation,
  useGetAdminBooksQuery,
  useClearAiStudyCacheMutation,
  useToggleBookStatusMutation,
  useDeleteBookMutation,
  useBulkImportBooksMutation,
  useGetRecommendationsQuery,
  useRefreshRecommendationsMutation,
  useGetSimilarBooksQuery,
  useGetBookExplanationQuery,
  useGetBookSummaryQuery,
  useGetAiStudySummaryQuery,
  useGetAiStudyMcqQuery,
  useGetAiStudyKeyPointsQuery,
  useGetReadingProgressQuery,
  useUpdateReadingProgressMutation,
  useAddBookmarkMutation,
  useEditBookmarkMutation,
  useRemoveBookmarkMutation,
  useCreateBookMutation,
  useUpdateBookMutation,
  useSearchSmartBooksQuery,
  useAddSmartBookMutation,
  useCreateReviewMutation,
  useHelpfulReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  useFlagReviewRemoveMutation,
  useGetBookReviewsQuery,
  useGetReviewDistributionQuery,
  useGetMyReviewsQuery,
  useDownloadBookMutation,
} = api;
