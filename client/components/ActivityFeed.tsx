import React from "react";
import { DashboardData } from "../types";

interface ActivityFeedProps {
  activities: DashboardData["recentActivity"];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  if (!activities || activities.length === 0) {
    return <p className="text-center text-gray-400 py-4">No recent activity</p>;
  }

  const getEventDetails = (eventType: string) => {
    switch (eventType) {
      case "view":
        return { icon: "👁", bgColor: "bg-gray-100", textColor: "text-gray-600", label: "Viewed" };
      case "download":
        return { icon: "↓", bgColor: "bg-blue-100", textColor: "text-blue-600", label: "Downloaded" };
      case "rate":
        return { icon: "★", bgColor: "bg-yellow-100", textColor: "text-yellow-600", label: "Rated" };
      case "bookmark":
        return { icon: "🔖", bgColor: "bg-purple-100", textColor: "text-purple-600", label: "Bookmarked" };
      case "complete":
        return { icon: "✓", bgColor: "bg-green-100", textColor: "text-green-600", label: "Finished reading" };
      case "progress":
        return { icon: "◎", bgColor: "bg-blue-50", textColor: "text-blue-400", label: "Updated progress" };
      default:
        return { icon: "•", bgColor: "bg-gray-100", textColor: "text-gray-500", label: "Interacted with" };
    }
  };

  return (
    <div className="flex flex-col">
      {activities.map((activity) => {
        const details = getEventDetails(activity.eventType);
        return (
          <div key={activity._id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${details.bgColor} ${details.textColor} text-sm flex-shrink-0`}>
              {details.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 line-clamp-1">
                {typeof activity.bookId === "string" ? "Unknown Book" : activity.bookId.title}
              </p>
              <p className="text-xs text-gray-400">{details.label}</p>
            </div>
            
            <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              {timeAgo(activity.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
