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
  setImmediate(async () => {
    try {
      await UserActivity.create({
        userId: params.userId.toString(),
        bookId: params.bookId.toString(),
        eventType: params.eventType,
        ...(params.rating && { rating: params.rating }),
        ...(params.metadata && { metadata: params.metadata })
      });
    } catch (error) {
      console.error("[Activity] Log failed:", error);
    }
  });
}
