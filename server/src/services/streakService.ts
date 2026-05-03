import { IUser, User } from "../models/User";

export async function updateStreak(userId: string): Promise<void> {
  try {
    const user = await User.findById(userId).select("streak longestStreak lastActiveDate");

    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!user.lastActiveDate) {
      user.streak = 1;
      user.longestStreak = 1;
      user.lastActiveDate = new Date();
      await user.save();
      return;
    }

    const last = new Date(user.lastActiveDate);
    last.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - last.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return;
    }

    if (diffDays === 1) {
      user.streak++;
    } else {
      user.streak = 1;
    }

    user.longestStreak = Math.max(user.streak, user.longestStreak);
    user.lastActiveDate = new Date();
    await user.save();
  } catch (err) {
    console.error("[Streak] updateStreak failed:", err);
  }
}

export function getStreakStatus(user: IUser | any): {
  streak: number;
  longestStreak: number;
  isActiveToday: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isActiveToday = false;

  if (user.lastActiveDate) {
    const lastActiveDate = new Date(user.lastActiveDate);
    lastActiveDate.setHours(0, 0, 0, 0);
    isActiveToday = lastActiveDate.getTime() === today.getTime();
  }

  return {
    streak: user.streak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    isActiveToday,
  };
}
