"use client";

import React, { useEffect, useState } from "react";

interface WeeklyActivityChartProps {
  weeklyActivity: { date: string; sessions: number }[];
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  weeklyActivity,
}) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const maxSessions = Math.max(...weeklyActivity.map((d) => d.sessions), 1);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h3 className="font-medium text-gray-700 mb-4">This week</h3>

      <div className="flex justify-between items-end h-32 gap-2 max-w-sm mx-auto">
        {weeklyActivity.map((day, idx) => {
          const dayName = new Date(day.date).toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "UTC"
          });
          
          const heightPercent = mounted 
            ? Math.max((day.sessions / maxSessions) * 100, day.sessions > 0 ? 5 : 0)
            : 0;

          return (
            <div key={idx} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-xs text-gray-600 h-4 font-medium">
                {day.sessions > 0 ? day.sessions : ""}
              </span>
              <div className="h-20 w-6 bg-gray-100 rounded-full flex flex-col justify-end overflow-hidden">
                <div
                  className={`w-full rounded-full transition-all duration-500 ease-out ${
                    day.sessions === 0 ? "bg-gray-200" : "bg-blue-500"
                  }`}
                  style={{ height: `${heightPercent}%`, minHeight: day.sessions === 0 ? "0px" : "4px" }}
                />
              </div>
              <span className="text-xs text-gray-400 mt-1">{dayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
