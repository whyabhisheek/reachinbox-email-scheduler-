import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { redisConnection } from "../config/redis.js";
import type { EmailQueueJobData } from "../queues/email.queue.js";
import { emailQueue } from "../queues/email.queue.js";
import { processEmailJob } from "../services/email-worker.service.js";

const emailWorker = new Worker<EmailQueueJobData>(env.EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: env.WORKER_CONCURRENCY
});

emailWorker.on("completed", (job) => {
  console.log(`Email worker completed BullMQ job ${job.id}`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Email worker failed BullMQ job ${job?.id}: ${error.message}`);
});

emailWorker.on("error", (error) => {
  console.error("Email worker error:", error);
});

console.log(
  `Email worker listening on queue "${env.EMAIL_QUEUE_NAME}" with concurrency ${env.WORKER_CONCURRENCY}`
);

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log("Shutting down email worker...");
  await emailWorker.close();
  await emailQueue.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
