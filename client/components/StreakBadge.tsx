import React from "react";
import { Badge } from "./ui/Badge";

interface StreakBadgeProps {
  streak: number;
  longestStreak: number;
  isActiveToday: boolean;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({
  streak,
  longestStreak,
  isActiveToday,
}) => {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4">
      <div className="flex flex-col items-center justify-center min-w-[60px]">
        <div className="text-[2.5rem] leading-none mb-1">🔥</div>
        <div className="font-bold text-2xl text-orange-600 leading-none">{streak}</div>
        <div className="text-[10px] uppercase tracking-wider text-orange-400 mt-1 font-bold">Day Streak</div>
      </div>

      <div className="flex-1">
        <p className="text-sm text-gray-600 mb-2">Longest: {longestStreak} days</p>
        {isActiveToday ? (
          <Badge variant="success">Active today ✓</Badge>
        ) : (
          <Badge variant="warning">Read today to continue!</Badge>
        )}
      </div>
    </div>
  );
};
