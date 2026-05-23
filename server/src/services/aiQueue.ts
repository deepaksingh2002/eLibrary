import { Queue, Worker, Job } from "bullmq";
import { redisConfigFromEnv } from "../config/redisConfig";
import { generateBookSummary, generateMCQQuestions, generateKeyPoints, generateFlashcards } from "./aiStudyService";
import AIStudyCache from "../models/AIStudyCache";
import { Types } from "mongoose";

const connection = redisConfigFromEnv();
export const aiQueue = connection ? new Queue("ai-jobs", { connection }) : null;

type AIJobType = "summary" | "mcq" | "keypoints" | "flashcards";

async function persistAIResult(
  bookId: string,
  type: AIJobType,
  data: unknown,
) {
  await AIStudyCache.findOneAndUpdate(
    { bookId: new Types.ObjectId(bookId), type },
    {
      $set: {
        data,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    },
    { upsert: true },
  );
}

async function runAIJob(bookId: string, type: AIJobType, opts: any = {}) {
  if (type === "summary") {
    const summary = await generateBookSummary({ _id: bookId } as any);
    await persistAIResult(bookId, type, summary);
    return summary;
  }

  if (type === "mcq") {
    const questions = await generateMCQQuestions({ _id: bookId } as any, opts?.count || 10);
    await persistAIResult(bookId, type, questions);
    return questions;
  }

  if (type === "keypoints") {
    const keyPoints = await generateKeyPoints({ _id: bookId } as any);
    await persistAIResult(bookId, type, keyPoints);
    return keyPoints;
  }

  if (type === "flashcards") {
    const cards = await generateFlashcards({ _id: bookId } as any, opts?.count || 8);
    await persistAIResult(bookId, type, cards);
    return cards;
  }

  throw new Error(`Unsupported AI job type: ${type}`);
}

export async function enqueueAIJob(bookId: string, type: string, opts: any = {}) {
  if (!aiQueue) {
    await runAIJob(bookId, type as AIJobType, opts);
    return `inline-${type}-${Date.now()}`;
  }

  const name = type;
  const job = await aiQueue.add(name, { bookId, opts });
  return job.id;
}

// Worker that performs AI generation and saves results to cache
export function initAIWorker() {
  if (!connection) {
    return null;
  }

  // Keep a single worker per process
  const worker = new Worker(
    "ai-jobs",
    async (job: Job) => {
      const { bookId, opts } = job.data as any;
      const type = job.name;
      try {
        await runAIJob(bookId, type as AIJobType, opts);
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
