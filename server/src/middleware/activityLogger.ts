import { Types } from "mongoose";
import { UserActivity } from "../models/UserActivity";

interface LogActivityParams {
  userId: string | Types.ObjectId;
  bookId: string | Types.ObjectId;
  eventType: "view" | "download" | "rate" | "bookmark" | "complete" | "progress";
  rating?: number;
  metadata?: Record<string, any>;
}

export function logActivity(params: LogActivityParams): void {
  setImmediate(() => {
    UserActivity.create(params).catch((error) => {
      console.error("Failed to log user activity:", error);
    });
  });
}
