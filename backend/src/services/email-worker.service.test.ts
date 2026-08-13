import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { EmailQueueJobData } from "../queues/email.queue.js";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    emailJob: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("../queues/email.queue.js", () => ({
  addDelayedEmailJob: vi.fn()
}));

vi.mock("./rate-limit.service.js", () => ({
  reserveEmailSendSlot: vi.fn()
}));

vi.mock("./smtp.service.js", () => ({
  sendEmail: vi.fn(),
  parseAttachmentInput: vi.fn()
}));

import { prisma } from "../config/prisma.js";
import { addDelayedEmailJob } from "../queues/email.queue.js";
import { reserveEmailSendSlot } from "./rate-limit.service.js";
import { parseAttachmentInput, sendEmail } from "./smtp.service.js";
import { processEmailJob } from "./email-worker.service.js";

const sender = { id: "sender-1", name: "Sender", email: "sender@example.com" };

const emailJob = {
  id: "job-1",
  userId: "user-1",
  senderId: "sender-1",
  recipient: "r@example.com",
  subject: "Hello",
  body: "World",
  scheduledAt: new Date(Date.now() - 1000),
  sentAt: null,
  status: "scheduled",
  bullmqJobId: "email-job-1-123",
  attempts: 0,
  error: null,
  hourlyLimit: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender
};

const job = {
  id: "email-job-1-123",
  data: { emailJobId: "job-1", userId: "user-1", senderId: "sender-1" }
} as Job<EmailQueueJobData>;

function reserveAllowed() {
  (reserveEmailSendSlot as Mock).mockResolvedValue({
    allowed: true,
    rateKey: "email-rate:sender-1:100",
    hourlyCount: 1,
    nextAllowedAt: new Date(Date.now() + 2000)
  });
}

describe("processEmailJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.emailJob.findUnique as Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as Mock).mockResolvedValue({ count: 1 });
    (prisma.emailJob.update as Mock).mockResolvedValue(emailJob);
    (addDelayedEmailJob as Mock).mockResolvedValue({ bullmqJobId: "email-job-rescheduled" });
    (parseAttachmentInput as Mock).mockReturnValue(null);
    reserveAllowed();
  });

  it("throws when the email job no longer exists", async () => {
    (prisma.emailJob.findUnique as Mock).mockResolvedValue(null);

    await expect(processEmailJob(job)).rejects.toThrow(/not found/i);
  });

  it("skips already-sent emails", async () => {
    (prisma.emailJob.findUnique as Mock).mockResolvedValue({
      ...emailJob,
      status: "sent",
      sentAt: new Date()
    });

    const result = await processEmailJob(job);

    expect(result).toEqual({ skipped: true, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("throws on a BullMQ job id mismatch", async () => {
    (prisma.emailJob.findUnique as Mock).mockResolvedValue({
      ...emailJob,
      bullmqJobId: "email-job-different"
    });

    await expect(processEmailJob(job)).rejects.toThrow(/mismatch/i);
  });

  it("skips when another worker already processed the job", async () => {
    (prisma.emailJob.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.emailJob.findUnique as Mock)
      .mockResolvedValueOnce(emailJob)
      .mockResolvedValueOnce({ ...emailJob, status: "processing", updatedAt: new Date() });

    const result = await processEmailJob(job);

    expect(result).toEqual({ skipped: true, reason: "already_processing_by_another_worker" });
  });

  it("reclaims a stale processing job left behind by a crashed worker", async () => {
    (prisma.emailJob.updateMany as Mock)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    (prisma.emailJob.findUnique as Mock)
      .mockResolvedValueOnce(emailJob)
      .mockResolvedValueOnce({
        ...emailJob,
        status: "processing",
        updatedAt: new Date(Date.now() - 60 * 1000)
      });
    (sendEmail as Mock).mockResolvedValue({
      messageId: "message-reclaimed",
      accepted: ["r@example.com"],
      rejected: [],
      response: "250 OK",
      previewUrl: "https://ethereal.email/message/preview"
    });

    const result = await processEmailJob(job);

    expect(prisma.emailJob.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-1",
          status: "processing",
          updatedAt: { lt: expect.any(Date) }
        })
      })
    );
    expect(result).toMatchObject({ sent: true, messageId: "message-reclaimed" });
  });

  it("skips when the job was already sent after transition", async () => {
    (prisma.emailJob.updateMany as Mock).mockResolvedValue({ count: 0 });
    (prisma.emailJob.findUnique as Mock)
      .mockResolvedValueOnce(emailJob)
      .mockResolvedValueOnce({ ...emailJob, status: "sent", sentAt: new Date() });

    const result = await processEmailJob(job);

    expect(result).toEqual({ skipped: true, reason: "already_sent_after_transition" });
  });

  it("reschedules when the hourly rate limit denies the send", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    (reserveEmailSendSlot as Mock).mockResolvedValue({
      allowed: false,
      reason: "hourly_limit",
      retryAt,
      rateKey: "email-rate:sender-1:100",
      hourlyCount: 100
    });

    const result = await processEmailJob(job);

    expect(addDelayedEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({
        emailJobId: "job-1",
        senderId: "sender-1",
        rescheduledAt: retryAt.toISOString()
      }),
      retryAt
    );
    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "queued",
        scheduledAt: retryAt,
        bullmqJobId: "email-job-rescheduled"
      })
    });
    expect(result).toMatchObject({ rescheduled: true, reason: "hourly_limit" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reschedules when the minimum sender delay is active", async () => {
    const retryAt = new Date(Date.now() + 10_000);
    (reserveEmailSendSlot as Mock).mockResolvedValue({
      allowed: false,
      reason: "minimum_delay",
      retryAt,
      rateKey: "email-rate:sender-1:100",
      hourlyCount: 5
    });

    const result = await processEmailJob(job);

    expect(result).toMatchObject({ rescheduled: true, reason: "minimum_delay" });
    expect(addDelayedEmailJob).toHaveBeenCalledTimes(1);
  });

  it("sends the email and marks the job as sent", async () => {
    (sendEmail as Mock).mockResolvedValue({
      messageId: "message-1",
      accepted: ["r@example.com"],
      rejected: [],
      response: "250 OK",
      previewUrl: "https://ethereal.email/message/preview"
    });

    const result = await processEmailJob(job);

    expect(sendEmail).toHaveBeenCalledWith({
      fromName: "Sender",
      fromEmail: "sender@example.com",
      to: "r@example.com",
      subject: "Hello",
      body: "World",
      attachments: null
    });
    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "sent",
        sentAt: expect.any(Date),
        error: null
      })
    });
    expect(result).toMatchObject({ sent: true, messageId: "message-1" });
  });

  it("marks the job failed and rethrows when SMTP rejects", async () => {
    (sendEmail as Mock).mockRejectedValue(new Error("SMTP send failed: 550 rejected"));

    await expect(processEmailJob(job)).rejects.toThrow("SMTP send failed: 550 rejected");

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        attempts: { increment: 1 },
        error: "SMTP send failed: 550 rejected"
      })
    });
  });

  it("releases the job back to failed so retries can reprocess when the rate limiter throws", async () => {
    (reserveEmailSendSlot as Mock).mockRejectedValue(new Error("Redis connection lost"));

    await expect(processEmailJob(job)).rejects.toThrow("Redis connection lost");

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        attempts: { increment: 1 },
        error: "Redis connection lost"
      })
    });
  });

  it("releases the job back to failed when transitioning to processing throws", async () => {
    (prisma.emailJob.updateMany as Mock).mockRejectedValue(new Error("database down"));

    await expect(processEmailJob(job)).rejects.toThrow("database down");

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "failed",
        attempts: { increment: 1 }
      })
    });
  });
});
