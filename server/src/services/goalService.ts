import { ReadingProgress } from "../models/ReadingProgress";
import { User } from "../models/User";

export async function getMonthlyGoalProgress(userId: string): Promise<{
  goal: number;
  booksCompletedThisMonth: number;
  percentage: number;
  isGoalSet: boolean;
}> {
  const user = await User.findById(userId).select("monthlyGoal");

  if (!user || user.monthlyGoal === 0) {
    return {
      goal: 0,
      booksCompletedThisMonth: 0,
      percentage: 0,
      isGoalSet: false,
    };
  }

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const booksCompletedThisMonth = await ReadingProgress.countDocuments({
    userId,
    status: "completed",
    updatedAt: { $gte: firstDayOfMonth },
  });

  const percentage = Math.min(
    100,
    Math.round((booksCompletedThisMonth / user.monthlyGoal) * 100)
  );

  return {
    goal: user.monthlyGoal,
    booksCompletedThisMonth,
    percentage,
    isGoalSet: true,
  };
}
