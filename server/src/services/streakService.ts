import { IUser, User } from "../models/User";

export async function updateStreak(userId: string): Promise<void> {
  const user = await User.findById(userId).select("streak longestStreak lastActiveDate");

  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newStreak = 1;

  if (user.lastActiveDate) {
    const last = new Date(user.lastActiveDate);
    last.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return;
    }

    if (diffDays === 1) {
      newStreak = user.streak + 1;
    }
  }

  await User.findByIdAndUpdate(userId, {
    streak: newStreak,
    longestStreak: Math.max(newStreak, user.longestStreak ?? 0),
    lastActiveDate: new Date(),
  });
}

export function getStreakStatus(user: IUser): {
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
