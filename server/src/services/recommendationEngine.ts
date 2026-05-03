import { UserActivity } from "../models/UserActivity";
import { User } from "../models/User";
import { Book } from "../models/Book";
import { Recommendation } from "../models/Recommendation";
import { Types } from "mongoose";

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function computeColdStartForUser(userId: string): Promise<void> {
  const user = await User.findById(userId).select("preferences").lean();
  const genres = user?.preferences?.genres || [];

  let topBooks: { _id: Types.ObjectId }[] = [];

  if (genres.length > 0) {
    topBooks = await Book.find({
      genre: { $in: genres },
      status: "published",
      isDeleted: false,
      avgRating: { $gte: 3.5 }
    })
      .sort({ avgRating: -1, downloads: -1 })
      .limit(20)
      .select("_id")
      .lean();
  }

  if (topBooks.length === 0) {
    topBooks = await Book.find({ status: "published", isDeleted: false })
      .sort({ avgRating: -1, downloads: -1 })
      .limit(20)
      .select("_id")
      .lean();
  }

  await Recommendation.findOneAndUpdate(
    { userId },
    {
      books: topBooks.map((b) => ({
        bookId: b._id,
        score: 1,
        reason: "cold-start"
      })),
      computedAt: new Date(),
      isColdStart: true,
      $inc: { version: 1 }
    },
    { upsert: true, new: true }
  );
}

export async function computeRecommendations(): Promise<void> {
  const startTime = Date.now();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const activities = await UserActivity.find({ createdAt: { $gte: since } })
    .select("userId bookId eventType rating")
    .lean();

  const eventWeights: Record<string, number> = {
    view: 1,
    download: 3,
    rate: 2,
    bookmark: 2,
    complete: 5,
    progress: 1,
  };

  type UserProfile = {
    bookIds: Set<string>;
    weightedBooks: Map<string, number>;
    totalEvents: number;
  };

  const userProfiles = new Map<string, UserProfile>();

  for (const activity of activities) {
    const uid = activity.userId.toString();
    if (!userProfiles.has(uid)) {
      userProfiles.set(uid, {
        bookIds: new Set(),
        weightedBooks: new Map(),
        totalEvents: 0
      });
    }
    const profile = userProfiles.get(uid)!;
    profile.bookIds.add(activity.bookId.toString());
    const weight = eventWeights[activity.eventType] || 1;
    const current = profile.weightedBooks.get(activity.bookId.toString()) || 0;
    profile.weightedBooks.set(activity.bookId.toString(), current + weight);
    profile.totalEvents++;
  }

  const COLD_START_THRESHOLD = 5;

  const activeUsers: string[] = [];
  const coldStartUsers: string[] = [];

  for (const [uid, profile] of userProfiles) {
    if (profile.totalEvents >= COLD_START_THRESHOLD) {
      activeUsers.push(uid);
    } else {
      coldStartUsers.push(uid);
    }
  }

  const allUserIds = await User.find({ isDeleted: false }).select("_id").lean();
  const usersWithActivity = new Set(userProfiles.keys());
  const zeroActivityUsers = allUserIds
    .map((u) => u._id.toString())
    .filter((id) => !usersWithActivity.has(id));

  coldStartUsers.push(...zeroActivityUsers);

  const topActiveUsers = [...activeUsers]
    .sort((a, b) => userProfiles.get(b)!.totalEvents - userProfiles.get(a)!.totalEvents)
    .slice(0, 200);

  for (const userId of topActiveUsers) {
    const targetProfile = userProfiles.get(userId)!;
    
    const similarities: { uid: string; score: number }[] = [];
    for (const otherId of topActiveUsers) {
      if (otherId === userId) continue;
      const otherProfile = userProfiles.get(otherId)!;
      const score = jaccardSimilarity(targetProfile.bookIds, otherProfile.bookIds);
      if (score > 0) {
        similarities.push({ uid: otherId, score });
      }
    }
    
    similarities.sort((a, b) => b.score - a.score);
    const topSimilar = similarities.slice(0, 10);
    
    const candidateScores = new Map<string, number>();
    for (const sim of topSimilar) {
      const similarProfile = userProfiles.get(sim.uid)!;
      for (const [bookId, weight] of similarProfile.weightedBooks) {
        if (targetProfile.bookIds.has(bookId)) continue;
        
        const current = candidateScores.get(bookId) || 0;
        candidateScores.set(bookId, current + weight * sim.score);
      }
    }
    
    const candidates = Array.from(candidateScores.entries())
      .map(([bookId, score]) => ({ bookId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
      
    if (candidates.length > 0) {
      await Recommendation.findOneAndUpdate(
        { userId },
        {
          books: candidates.map((b) => ({
            bookId: new Types.ObjectId(b.bookId),
            score: Math.round(b.score * 100) / 100,
            reason: "collaborative"
          })),
          computedAt: new Date(),
          isColdStart: false,
          $inc: { version: 1 }
        },
        { upsert: true, new: true }
      );
    } else {
      await computeColdStartForUser(userId);
    }
  }

  for (const userId of coldStartUsers) {
    await computeColdStartForUser(userId);
  }

  console.info(`[Recommendations] Computed:
    Active users processed: ${topActiveUsers.length}
    Cold-start users: ${coldStartUsers.length}
    Total upserted: ${topActiveUsers.length + coldStartUsers.length}
    Duration: ${Date.now() - startTime}ms
  `);
}

export async function getSimilarBooks(
  bookId: string,
  limit = 6
): Promise<{ bookId: string; score: number }[]> {
  const targetBook = await Book.findById(bookId).lean();
  if (!targetBook) return [];

  const otherBooks = await Book.find({
    status: "published",
    isDeleted: false,
    _id: { $ne: targetBook._id }
  }).select("genre tags author").lean();

  const results: { bookId: string; score: number }[] = [];

  for (const other of otherBooks) {
    let score = 0;

    if (targetBook.genre === other.genre) score += 0.4;
    if (targetBook.author.toLowerCase() === other.author.toLowerCase()) score += 0.3;

    const tagsA = new Set((targetBook.tags || []).map((t: string) => t.toLowerCase()));
    const tagsB = new Set((other.tags || []).map((t: string) => t.toLowerCase()));
    const tagJaccard = jaccardSimilarity(tagsA, tagsB);
    score += tagJaccard * 0.3;

    if (score > 0) {
      results.push({ bookId: other._id.toString(), score: Math.round(score * 100) / 100 });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
