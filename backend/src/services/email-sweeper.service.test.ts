import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    emailJob: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock("../queues/email.queue.js", () => ({
  emailQueue: {
    getJobs: vi.fn()
  }
}));

import { prisma } from "../config/prisma.js";
import { emailQueue } from "../queues/email.queue.js";
import { sweepOrphanedEmailJobs } from "./email-sweeper.service.js";

const now = new Date("2026-01-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.emailJob.updateMany as Mock).mockResolvedValue({ count: 1 });
});

describe("sweepOrphanedEmailJobs", () => {
  it("marks a past-due scheduled job with no bullmq job id as failed", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([{ id: "orphan-1", bullmqJobId: null }]);
    (emailQueue.getJobs as Mock).mockResolvedValue([]);

    const result = await sweepOrphanedEmailJobs({ now });

    expect(prisma.emailJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: "orphan-1",
        status: {
          in: ["scheduled", "queued", "processing"]
        }
      },
      data: {
        status: "failed",
        error: "Orphaned email job: no live queue job was found for it."
      }
    });
    expect(result).toEqual({ scanned: 1, orphaned: 1, markedFailed: 1 });
  });

  it("marks a queued job whose bullmq job id is no longer live as failed", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([
      { id: "orphan-2", bullmqJobId: "email-job-42" }
    ]);
    (emailQueue.getJobs as Mock).mockResolvedValue([{ id: "email-job-9" }]);

    const result = await sweepOrphanedEmailJobs({ now });

    expect(prisma.emailJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "orphan-2" })
      })
    );
    expect(result).toEqual({ scanned: 1, orphaned: 1, markedFailed: 1 });
  });

  it("skips a job whose bullmq job id is currently live in Redis", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([
      { id: "alive-1", bullmqJobId: "email-job-9" }
    ]);
    (emailQueue.getJobs as Mock).mockResolvedValue([{ id: "email-job-9" }]);

    const result = await sweepOrphanedEmailJobs({ now });

    expect(prisma.emailJob.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, orphaned: 0, markedFailed: 0 });
  });

  it("only queries candidates that are past the orphan grace period", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([]);
    (emailQueue.getJobs as Mock).mockResolvedValue([]);

    await sweepOrphanedEmailJobs({ now });

    expect(prisma.emailJob.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: ["scheduled", "queued", "processing"]
        },
        scheduledAt: {
          lte: new Date(now.getTime() - 60 * 1000)
        }
      },
      select: {
        id: true,
        bullmqJobId: true
      }
    });
  });

  it("searches only live job states in Redis", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([]);

    await sweepOrphanedEmailJobs({ now });

    expect(emailQueue.getJobs).toHaveBeenCalledWith(
      ["waiting", "delayed", "active", "prioritized"],
      0,
      100000
    );
  });

  it("returns zeros without updating when there are no candidates", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([]);
    (emailQueue.getJobs as Mock).mockResolvedValue([]);

    const result = await sweepOrphanedEmailJobs({ now });

    expect(result).toEqual({ scanned: 0, orphaned: 0, markedFailed: 0 });
    expect(prisma.emailJob.updateMany).not.toHaveBeenCalled();
  });

  it("does not count a job that was claimed by the worker mid-sweep", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([
      { id: "contested-1", bullmqJobId: null }
    ]);
    (emailQueue.getJobs as Mock).mockResolvedValue([]);
    (prisma.emailJob.updateMany as Mock).mockResolvedValue({ count: 0 });

    const result = await sweepOrphanedEmailJobs({ now });

    expect(result).toEqual({ scanned: 1, orphaned: 1, markedFailed: 0 });
  });

  it("marks a stale processing job whose queue job is gone as failed", async () => {
    (prisma.emailJob.findMany as Mock).mockResolvedValue([
      { id: "stuck-1", bullmqJobId: "email-job-lost" }
    ]);
    (emailQueue.getJobs as Mock).mockResolvedValue([]);

    const result = await sweepOrphanedEmailJobs({ now });

    expect(prisma.emailJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "stuck-1",
          status: expect.objectContaining({ in: expect.arrayContaining(["processing"]) })
        })
      })
    );
    expect(result).toEqual({ scanned: 1, orphaned: 1, markedFailed: 1 });
  });
});
