import { Queue, Worker, Job } from "bullmq";
import { redisConfigFromEnv } from "../config/redisConfig";
import { generateBookSummary, generateMCQQuestions, generateKeyPoints, generateFlashcards } from "./aiStudyService";
import AIStudyCache from "../models/AIStudyCache";
import { Types } from "mongoose";

const connection = redisConfigFromEnv();
export const aiQueue = connection ? new Queue("ai-jobs", { connection }) : null;

export async function enqueueAIJob(bookId: string, type: string, opts: any = {}) {
  if (!aiQueue) {
    throw new Error("AI job queue is disabled because Redis is not configured");
  }

  const name = type;
  const job = await aiQueue.add(name, { bookId, opts });
  return job.id;
}

// Worker that performs AI generation and saves results to cache
export function initAIWorker() {
  if (!connection) {
    console.info("[AIQueue] Redis not configured; AI worker disabled");
    return null;
  }

  // Keep a single worker per process
  const worker = new Worker(
    "ai-jobs",
    async (job: Job) => {
      const { bookId, opts } = job.data as any;
      const type = job.name;
      try {
        if (type === "summary") {
          const summary = await generateBookSummary({ _id: bookId } as any);
          await AIStudyCache.findOneAndUpdate({ bookId: new Types.ObjectId(bookId), type }, { $set: { data: summary, createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }, { upsert: true });
        }
        if (type === "mcq") {
          const questions = await generateMCQQuestions({ _id: bookId } as any, opts?.count || 10);
          await AIStudyCache.findOneAndUpdate({ bookId: new Types.ObjectId(bookId), type }, { $set: { data: questions, createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }, { upsert: true });
        }
        if (type === "keypoints") {
          const keyPoints = await generateKeyPoints({ _id: bookId } as any);
          await AIStudyCache.findOneAndUpdate({ bookId: new Types.ObjectId(bookId), type }, { $set: { data: keyPoints, createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }, { upsert: true });
        }
        if (type === "flashcards") {
          const cards = await generateFlashcards({ _id: bookId } as any, opts?.count || 8);
          await AIStudyCache.findOneAndUpdate({ bookId: new Types.ObjectId(bookId), type }, { $set: { data: cards, createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }, { upsert: true });
        }
      } catch (err: any) {
        console.error(`[AIQueue] Job ${job.id} (${type}) failed:`, err?.message || err);
        throw err;
      }
    },
    { connection },
  );

  worker.on("completed", (job: Job) => {
    console.info(`[AIQueue] Job ${job.id} (${job.name}) completed`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[AIQueue] Job ${job?.id} (${job?.name}) failed:`, err?.message || err);
  });

  console.info("[AIQueue] Worker initialized");
  return worker;
}

export default aiQueue;
