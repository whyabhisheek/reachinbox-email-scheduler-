import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { HttpError } from "../errors/http-error.js";
import type { AuthenticatedUser } from "../types/auth.js";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    sender: {
      findFirst: vi.fn(),
      upsert: vi.fn()
    },
    emailJob: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("../queues/email.queue.js", () => ({
  addDelayedEmailJob: vi.fn()
}));

import { addDelayedEmailJob } from "../queues/email.queue.js";
import { prisma } from "../config/prisma.js";
import {
  getEmailJobById,
  listScheduledEmails,
  listSentEmails,
  scheduleEmails
} from "./email.service.js";

const sender = { id: "sender-1", userId: "user-1", name: "Sender", email: "sender@example.com" };

const createdJob = {
  id: "job-1",
  userId: "user-1",
  senderId: "sender-1",
  recipient: "b@example.com",
  subject: "Hello",
  body: "World",
  scheduledAt: new Date(Date.now() + 60_000),
  sentAt: null,
  status: "scheduled",
  bullmqJobId: null,
  attempts: 0,
  error: null,
  hourlyLimit: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender
};

const user: AuthenticatedUser = {
  id: "user-1",
  googleId: null,
  name: "Test User",
  email: "test@example.com",
  avatar: null
};

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    recipients: ["a@example.com", "b@example.com"],
    subject: "Hello",
    body: "World",
    scheduledAt: new Date(Date.now() + 60_000),
    hourlyLimit: 100,
    ...overrides
  };
}

describe("scheduleEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.sender.upsert as Mock).mockResolvedValue(sender);
    (prisma.emailJob.findMany as Mock).mockResolvedValue([]);
    (prisma.emailJob.create as Mock).mockImplementation(
      (args: { data: { recipient: string } }) => ({
        ...createdJob,
        recipient: args.data.recipient
      })
    );
    (addDelayedEmailJob as Mock).mockResolvedValue({ bullmqJobId: "email-job-abc" });
    (prisma.emailJob.update as Mock).mockImplementation(
      (args: { data: Partial<typeof createdJob> }) =>
        Promise.resolve({ ...createdJob, ...args.data, bullmqJobId: "email-job-abc" })
    );
  });

  it("throws a 400 when the scheduled time is in the past", async () => {
    const input = baseInput({ scheduledAt: new Date(Date.now() - 5000) });

    await expect(scheduleEmails(user, input)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("throws a 400 when no start time is provided", async () => {
    const { scheduledAt: _scheduledAt, ...rest } = baseInput();

    await expect(scheduleEmails(user, rest)).rejects.toMatchObject({
      statusCode: 400,
      message: "Start time is required."
    });
  });

  it("throws a 400 when both sender and senderId are provided", async () => {
    const input = baseInput({ sender: { name: "X", email: "x@example.com" }, senderId: "sender-1" });

    await expect(scheduleEmails(user, input)).rejects.toMatchObject({
      statusCode: 400,
      message: "Use either senderId or sender, not both."
    });
  });

  it("deduplicates recipients before scheduling", async () => {
    const input = baseInput({
      recipients: ["A@Example.com", "a@example.com", "b@example.com"]
    });

    const result = await scheduleEmails(user, input);

    expect((prisma.emailJob.create as Mock).mock.calls).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it("spaces recipients by delayBetweenEmails in seconds", async () => {
    const scheduledAt = new Date(Date.now() + 60_000);
    const delayBetweenEmails = 5;
    const input = baseInput({ scheduledAt, delayBetweenEmails });

    await scheduleEmails(user, input);

    const createCalls = (prisma.emailJob.create as Mock).mock.calls.map((call) => call[0].data);
    expect(createCalls[0].scheduledAt.getTime()).toBe(scheduledAt.getTime());
    expect(createCalls[1].scheduledAt.getTime()).toBe(scheduledAt.getTime() + delayBetweenEmails * 1000);
  });

  it("skips jobs that already exist for the same recipient and scheduled time", async () => {
    const scheduledAt = new Date(Date.now() + 60_000);
    const existingJob = { ...createdJob, recipient: "a@example.com", scheduledAt };

    (prisma.emailJob.findMany as Mock).mockResolvedValue([existingJob]);

    const input = baseInput({ scheduledAt, recipients: ["a@example.com", "b@example.com"] });

    const result = await scheduleEmails(user, input);

    expect((prisma.emailJob.create as Mock).mock.calls).toHaveLength(1);
    expect((prisma.emailJob.create as Mock).mock.calls[0][0].data.recipient).toBe("b@example.com");
    expect(result.count).toBe(2);
  });

  it("stores Prisma.JsonNull for attachments when none are provided", async () => {
    await scheduleEmails(user, baseInput());

    const createData = (prisma.emailJob.create as Mock).mock.calls[0][0].data;
    expect(createData.attachments).toBe(Prisma.JsonNull);
  });

  it("stores the provided attachments", async () => {
    const attachments = [{ filename: "photo.png", content: "aGVsbG8=" }];
    const input = baseInput({ attachments });

    await scheduleEmails(user, input);

    const createData = (prisma.emailJob.create as Mock).mock.calls[0][0].data;
    expect(createData.attachments).toEqual(attachments);
  });

  it("queues each created job in BullMQ and marks it queued", async () => {
    await scheduleEmails(user, baseInput());

    expect(addDelayedEmailJob).toHaveBeenCalledTimes(2);
    expect(addDelayedEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({ emailJobId: "job-1", userId: "user-1", senderId: "sender-1" }),
      expect.any(Date)
    );
    const updateCalls = (prisma.emailJob.update as Mock).mock.calls;
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0][0].data.status).toBe("queued");
    expect(updateCalls[0][0].data.bullmqJobId).toBe("email-job-abc");
  });

  it("treats a unique-constraint conflict as an existing job instead of duplicating", async () => {
    const scheduledAt = new Date(Date.now() + 60_000);
    const conflict = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.13.0",
      meta: { target: ["userId", "senderId", "recipient", "subject", "md5(body)", "scheduledAt"] }
    });
    const existingJob = { ...createdJob, recipient: "a@example.com", scheduledAt };

    (prisma.emailJob.create as Mock)
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce((args: { data: { recipient: string } }) => ({
        ...createdJob,
        recipient: args.data.recipient
      }));
    (prisma.emailJob.findFirst as Mock).mockResolvedValue(existingJob);

    const input = baseInput({ scheduledAt, recipients: ["a@example.com", "b@example.com"] });

    const result = await scheduleEmails(user, input);

    expect(prisma.emailJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipient: "a@example.com" })
      })
    );
    expect((prisma.emailJob.create as Mock).mock.calls).toHaveLength(2);
    expect(addDelayedEmailJob).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(2);
  });

  it("throws a 404 when resolving a senderId that is not owned by the user", async () => {
    (prisma.sender.findFirst as Mock).mockResolvedValue(null);
    const input = baseInput({ senderId: "other-sender" });

    await expect(scheduleEmails(user, input)).rejects.toBeInstanceOf(HttpError);
    await expect(scheduleEmails(user, input)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("listScheduledEmails / listSentEmails / getEmailJobById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.emailJob.findMany as Mock).mockResolvedValue([createdJob]);
    (prisma.emailJob.findFirst as Mock).mockResolvedValue(createdJob);
  });

  it("lists scheduled emails", async () => {
    const jobs = await listScheduledEmails(user);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].recipient).toBe("b@example.com");
    expect(prisma.emailJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" })
      })
    );
  });

  it("lists sent emails", async () => {
    const jobs = await listSentEmails(user);

    expect(jobs).toHaveLength(1);
  });

  it("returns a job by id for the owning user", async () => {
    const job = await getEmailJobById(user, "job-1");

    expect(job.id).toBe("job-1");
    expect(prisma.emailJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-1" } })
    );
  });

  it("throws a 404 when the job does not belong to the user", async () => {
    (prisma.emailJob.findFirst as Mock).mockResolvedValue(null);

    await expect(getEmailJobById(user, "missing")).rejects.toMatchObject({ statusCode: 404 });
  });
});
