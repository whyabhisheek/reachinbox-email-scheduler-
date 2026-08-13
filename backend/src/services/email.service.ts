import { Prisma, type EmailJobStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../errors/http-error.js";
import { addDelayedEmailJob } from "../queues/email.queue.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type { ScheduleEmailInput } from "../validators/email.validator.js";

const scheduledStatuses: EmailJobStatus[] = ["scheduled", "queued", "processing"];
const sentStatuses: EmailJobStatus[] = ["sent", "failed"];

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function serializeEmailJob(job: EmailJobWithSender) {
  return {
    id: job.id,
    recipient: job.recipient,
    subject: job.subject,
    body: job.body,
    scheduledAt: job.scheduledAt,
    sentAt: job.sentAt,
    status: job.status,
    bullmqJobId: job.bullmqJobId,
    attempts: job.attempts,
    error: job.error,
    hourlyLimit: job.hourlyLimit,
    sender: {
      id: job.sender.id,
      name: job.sender.name,
      email: job.sender.email
    },
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

const emailJobInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.EmailJobInclude;

type EmailJobWithSender = Prisma.EmailJobGetPayload<{ include: typeof emailJobInclude }>;

async function resolveSender(user: AuthenticatedUser, input: ScheduleEmailInput) {
  if (input.senderId) {
    const sender = await prisma.sender.findFirst({
      where: {
        id: input.senderId,
        userId: user.id
      }
    });

    if (!sender) {
      throw new HttpError(404, "Sender not found.");
    }

    return sender;
  }

  const senderEmail = normalizeEmail(input.sender?.email ?? user.email);
  const senderName = input.sender?.name ?? user.name;

  return prisma.sender.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: senderEmail
      }
    },
    update: {
      name: senderName
    },
    create: {
      userId: user.id,
      name: senderName,
      email: senderEmail
    }
  });
}

export async function scheduleEmails(user: AuthenticatedUser, input: ScheduleEmailInput) {
  const scheduledAt = input.scheduledAt ?? input.startTime;

  if (!scheduledAt) {
    throw new HttpError(400, "Start time is required.");
  }

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, "Scheduled time is invalid.");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new HttpError(400, "Scheduled time must be in the future.");
  }

  if (input.sender && input.senderId) {
    throw new HttpError(400, "Use either senderId or sender, not both.");
  }

  const recipients = Array.from(new Set(input.recipients.map(normalizeEmail)));
  const sender = await resolveSender(user, input);
  const delayBetweenEmails = (input.delayBetweenEmails ?? 0) * 1000;
  const plannedJobs = recipients.map((recipient, index) => ({
    recipient,
    scheduledAt: new Date(scheduledAt.getTime() + index * delayBetweenEmails)
  }));

  const existingJobs = await prisma.emailJob.findMany({
    where: {
      userId: user.id,
      senderId: sender.id,
      subject: input.subject,
      body: input.body,
      OR: plannedJobs.map((plannedJob) => ({
        recipient: plannedJob.recipient,
        scheduledAt: plannedJob.scheduledAt
      }))
    },
    include: emailJobInclude
  });
  const existingJobKeys = new Set(
    existingJobs.map((job) => `${job.recipient}:${job.scheduledAt.toISOString()}`)
  );
  const jobsToCreate = plannedJobs.filter(
    (plannedJob) =>
      !existingJobKeys.has(`${plannedJob.recipient}:${plannedJob.scheduledAt.toISOString()}`)
  );

  const queuedJobs: EmailJobWithSender[] = [];

  for (const plannedJob of jobsToCreate) {
    let createdJob: EmailJobWithSender;

    try {
      createdJob = await prisma.emailJob.create({
        data: {
          userId: user.id,
          senderId: sender.id,
          recipient: plannedJob.recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt: plannedJob.scheduledAt,
          status: "scheduled",
          hourlyLimit: input.hourlyLimit,
          attachments: input.attachments ?? Prisma.JsonNull
        },
        include: emailJobInclude
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await prisma.emailJob.findFirst({
          where: {
            userId: user.id,
            senderId: sender.id,
            recipient: plannedJob.recipient,
            subject: input.subject,
            body: input.body,
            scheduledAt: plannedJob.scheduledAt
          },
          include: emailJobInclude
        });

        if (existing) {
          existingJobs.push(existing);
          continue;
        }
      }

      throw error;
    }

    const { bullmqJobId } = await addDelayedEmailJob(
      {
        emailJobId: createdJob.id,
        userId: user.id,
        senderId: sender.id
      },
      createdJob.scheduledAt
    );

    const queuedJob = await prisma.emailJob.update({
      where: {
        id: createdJob.id
      },
      data: {
        bullmqJobId,
        status: "queued"
      },
      include: emailJobInclude
    });

    queuedJobs.push(queuedJob);
  }

  const allJobs = [...existingJobs, ...queuedJobs].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  );

  return {
    count: allJobs.length,
    jobs: allJobs.map(serializeEmailJob)
  };
}

export async function listScheduledEmails(user: AuthenticatedUser) {
  const jobs = await prisma.emailJob.findMany({
    where: {
      userId: user.id,
      status: {
        in: scheduledStatuses
      }
    },
    include: emailJobInclude,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }]
  });

  return jobs.map(serializeEmailJob);
}

export async function listSentEmails(user: AuthenticatedUser) {
  const jobs = await prisma.emailJob.findMany({
    where: {
      userId: user.id,
      status: {
        in: sentStatuses
      }
    },
    include: emailJobInclude,
    orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }]
  });

  return jobs.map(serializeEmailJob);
}

export async function getEmailJobById(user: AuthenticatedUser, id: string) {
  const job = await prisma.emailJob.findFirst({
    where: {
      id,
      userId: user.id
    },
    include: emailJobInclude
  });

  if (!job) {
    throw new HttpError(404, "Email job not found.");
  }

  return serializeEmailJob(job);
}
