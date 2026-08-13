import { Worker, type Job } from "bullmq";
import { prisma } from "../config/prisma.js";
import { redisConnection } from "../config/redis.js";
import {
  emailSweeperQueue,
  scheduleNextSweep,
  type SweeperQueueData
} from "../queues/email-sweeper.queue.js";
import { sweepOrphanedEmailJobs } from "../services/email-sweeper.service.js";

export function startEmailSweeper() {
  const worker = new Worker<SweeperQueueData>(
    emailSweeperQueue.name,
    async (job: Job<SweeperQueueData>) => {
      const result = await sweepOrphanedEmailJobs();
      await scheduleNextSweep();
      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1
    }
  );

  worker.on("completed", (job) => {
    console.log(`Email sweeper completed BullMQ job ${job.id}:`, job.returnvalue);
  });

  worker.on("failed", (job, error) => {
    console.error(`Email sweeper failed BullMQ job ${job?.id}: ${error.message}`);
  });

  worker.on("error", (error) => {
    console.error("Email sweeper error:", error);
  });

  void sweepOrphanedEmailJobs()
    .then((result) => console.log("Initial email sweep complete:", result))
    .catch((error) => console.error("Initial email sweep failed:", error));

  void scheduleNextSweep();

  return worker;
}
