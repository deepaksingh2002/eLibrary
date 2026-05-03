import mongoose from "mongoose";

/**
 * Validates whether a string is a valid MongoDB ObjectId.
 */
export const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Trims whitespace and strips all HTML tags from a string.
 */
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/(<([^>]+)>)/gi, "");
};

/**
 * Parses and validates pagination params from a request query object.
 * Returns safe page, limit and pre-calculated skip.
 */
export const paginationParams = (
  query: Record<string, unknown>
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const rawLimit = parseInt(query.limit as string) || 12;
  const limit = Math.min(50, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
