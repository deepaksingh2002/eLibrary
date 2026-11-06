import { Queue, Worker, Job } from "bullmq";
import { redisConfigFromEnv } from "../config/redisConfig";
import { generateBookSummary, generateMCQQuestions, generateKeyPoints } from "./aiStudyService";
import AIStudyCache from "../models/AIStudyCache";
import { Types } from "mongoose";

const connection = redisConfigFromEnv();
export const aiQueue = connection ? new Queue("ai-jobs", { connection }) : null;
export const CACHE_VERSION = process.env.AI_CACHE_VERSION || "v1";

type AIJobType = "summary" | "mcq" | "keypoints";

async function persistAIResult(
  bookId: string,
  type: AIJobType,
  data: unknown,
) {
  const update: { $set: Record<string, unknown>; $unset?: Record<string, number> } = {
    $set: {
      data,
      createdAt: new Date(),
      ...(process.env.AI_CACHE_TTL_HOURS
        ? { expiresAt: new Date(Date.now() + Number(process.env.AI_CACHE_TTL_HOURS) * 60 * 60 * 1000) }
        : {}),
    },
  }
  if (!process.env.AI_CACHE_TTL_HOURS) update.$unset = { expiresAt: 1 }
  await AIStudyCache.findOneAndUpdate(
    ({ bookId: new Types.ObjectId(bookId), type } as any),
    update,
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
    const mcqResult = await generateMCQQuestions({ _id: bookId } as any, opts?.count || 10);
    await persistAIResult(bookId, type, mcqResult.questions);
    return mcqResult;
  }

  if (type === "keypoints") {
    const keyPoints = await generateKeyPoints({ _id: bookId } as any);
    await persistAIResult(bookId, type, keyPoints);
    return keyPoints;
  }

  throw new Error(`Unsupported AI job type: ${type}`);
}

export async function enqueueAIJob(bookId: string, type: string, opts: any = {}) {
  if (!aiQueue) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AI queue is unavailable because Redis is not configured")
    }
    await runAIJob(bookId, type as AIJobType, opts);
    return `inline-${type}-${Date.now()}`;
  }

  const name = type;
  const job = await aiQueue.add(name, { bookId, opts }, {
    jobId: `${bookId}:${type}:${CACHE_VERSION}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
  });
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
    {
      connection,
      concurrency: Math.max(1, Number(process.env.AI_WORKER_CONCURRENCY || 2)),
    },
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
