import { Queue, type JobsOptions } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";

export type EmailQueueJobData = {
  emailJobId: string;
  userId: string;
  senderId: string;
  rescheduledAt?: string;
};

export const emailQueue = new Queue<EmailQueueJobData>(env.EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.EMAIL_JOB_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.EMAIL_JOB_BACKOFF_MS
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60,
      count: 10000
    },
    removeOnFail: {
      age: 30 * 24 * 60 * 60
    }
  }
});

export function getEmailBullmqJobId(emailJobId: string, scheduledAt?: Date) {
  if (scheduledAt) {
    return `email-job-${emailJobId}-${scheduledAt.getTime()}`;
  }

  return `email-job-${emailJobId}`;
}

export function getDelayUntil(date: Date) {
  return Math.max(date.getTime() - Date.now(), 0);
}

export async function addDelayedEmailJob(data: EmailQueueJobData, scheduledAt: Date) {
  const jobId = getEmailBullmqJobId(data.emailJobId, data.rescheduledAt ? scheduledAt : undefined);
  const options: JobsOptions = {
    jobId,
    delay: getDelayUntil(scheduledAt)
  };

  const job = await emailQueue.add("send-email", data, options);

  return {
    bullmqJobId: String(job.id)
  };
}
