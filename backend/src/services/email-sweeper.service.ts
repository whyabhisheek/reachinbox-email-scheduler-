import type { JobType, Queue } from "bullmq";
import { prisma } from "../config/prisma.js";
import { emailQueue } from "../queues/email.queue.js";

const ORPHAN_GRACE_MS = 60 * 1000;

const LIVE_JOB_STATES: JobType[] = ["waiting", "delayed", "active", "prioritized"];

export type SweepResult = {
  scanned: number;
  orphaned: number;
  markedFailed: number;
};

export async function sweepOrphanedEmailJobs(
  options: { queue?: Queue; now?: Date } = {}
): Promise<SweepResult> {
  const { queue = emailQueue, now = new Date() } = options;

  const cutoff = new Date(now.getTime() - ORPHAN_GRACE_MS);

  const candidates = await prisma.emailJob.findMany({
    where: {
      status: {
        in: ["scheduled", "queued", "processing"]
      },
      scheduledAt: {
        lte: cutoff
      }
    },
    select: {
      id: true,
      bullmqJobId: true
    }
  });

  const liveJobIds = new Set<string>();
  const liveJobs = await queue.getJobs(LIVE_JOB_STATES, 0, 100000);
  for (const job of liveJobs) {
    liveJobIds.add(String(job.id));
  }

  const orphans = candidates.filter(
    (candidate) => !candidate.bullmqJobId || !liveJobIds.has(candidate.bullmqJobId)
  );

  let markedFailed = 0;
  for (const orphan of orphans) {
    const result = await prisma.emailJob.updateMany({
      where: {
        id: orphan.id,
        status: {
          in: ["scheduled", "queued", "processing"]
        }
      },
      data: {
        status: "failed",
        error: "Orphaned email job: no live queue job was found for it."
      }
    });
    markedFailed += result.count;
  }

  return {
    scanned: candidates.length,
    orphaned: orphans.length,
    markedFailed
  };
}
