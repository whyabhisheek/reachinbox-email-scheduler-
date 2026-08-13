import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";

export type SweeperQueueData = {
  ranAt: string;
};

export const SWEEPER_JOB_NAME = "sweep-orphaned-email-jobs";

export const emailSweeperQueue = new Queue<SweeperQueueData>("email-sweeper-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60,
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 1000
    }
  }
});

export async function scheduleNextSweep(
  scheduledAt: Date = new Date(Date.now() + env.EMAIL_SWEEPER_INTERVAL_MS)
): Promise<void> {
  await emailSweeperQueue.add(
    SWEEPER_JOB_NAME,
    {
      ranAt: new Date().toISOString()
    },
    {
      delay: Math.max(scheduledAt.getTime() - Date.now(), 0)
    }
  );
}
