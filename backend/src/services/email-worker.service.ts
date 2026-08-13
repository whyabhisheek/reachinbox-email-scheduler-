import type { Job } from "bullmq";
import { prisma } from "../config/prisma.js";
import { addDelayedEmailJob, type EmailQueueJobData } from "../queues/email.queue.js";
import { reserveEmailSendSlot } from "./rate-limit.service.js";
import { parseAttachmentInput, sendEmail } from "./smtp.service.js";

const processableStatuses = ["scheduled", "queued", "failed"] as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown worker error.";
}

export async function processEmailJob(job: Job<EmailQueueJobData>) {
  const emailJob = await prisma.emailJob.findUnique({
    where: {
      id: job.data.emailJobId
    },
    include: {
      sender: true
    }
  });

  if (!emailJob) {
    throw new Error(`EmailJob ${job.data.emailJobId} not found.`);
  }

  if (emailJob.sentAt || emailJob.status === "sent") {
    return {
      skipped: true,
      reason: "already_sent"
    };
  }

  if (emailJob.bullmqJobId && emailJob.bullmqJobId !== String(job.id)) {
    throw new Error(
      `BullMQ job mismatch for EmailJob ${emailJob.id}: expected ${emailJob.bullmqJobId}, got ${job.id}.`
    );
  }

  try {
    const transition = await prisma.emailJob.updateMany({
      where: {
        id: emailJob.id,
        status: {
          in: [...processableStatuses]
        }
      },
      data: {
        status: "processing",
        bullmqJobId: String(job.id),
        error: null
      }
    });

    if (transition.count !== 1) {
      const latest = await prisma.emailJob.findUnique({
        where: {
          id: emailJob.id
        }
      });

      if (latest?.status === "sent") {
        return {
          skipped: true,
          reason: "already_sent_after_transition"
        };
      }

      if (latest?.status === "processing") {
        return {
          skipped: true,
          reason: "already_processing_by_another_worker"
        };
      }

      throw new Error(`EmailJob ${emailJob.id} could not transition to processing.`);
    }

    const reservation = await reserveEmailSendSlot(emailJob.senderId, {
      maxPerHour: emailJob.hourlyLimit ?? undefined
    });

    if (!reservation.allowed) {
      const retryAt = reservation.retryAt;
      const { bullmqJobId } = await addDelayedEmailJob(
        {
          emailJobId: emailJob.id,
          userId: emailJob.userId,
          senderId: emailJob.senderId,
          rescheduledAt: retryAt.toISOString()
        },
        retryAt
      );

      await prisma.emailJob.update({
        where: {
          id: emailJob.id
        },
        data: {
          status: "queued",
          scheduledAt: retryAt,
          bullmqJobId,
          error:
            reservation.reason === "hourly_limit"
              ? `Hourly sender limit reached. Rescheduled for ${retryAt.toISOString()}.`
              : `Minimum sender delay active. Rescheduled for ${retryAt.toISOString()}.`
        }
      });

      return {
        rescheduled: true,
        reason: reservation.reason,
        retryAt,
        rateKey: reservation.rateKey,
        hourlyCount: reservation.hourlyCount
      };
    }

    const smtpResult = await sendEmail({
      fromName: emailJob.sender.name,
      fromEmail: emailJob.sender.email,
      to: emailJob.recipient,
      subject: emailJob.subject,
      body: emailJob.body,
      attachments: parseAttachmentInput(emailJob.attachments)
    });

    await prisma.emailJob.update({
      where: {
        id: emailJob.id
      },
      data: {
        status: "sent",
        sentAt: new Date(),
        error: null
      }
    });

    return {
      sent: true,
      messageId: smtpResult.messageId,
      previewUrl: smtpResult.previewUrl
    };
  } catch (error) {
    await prisma.emailJob.update({
      where: {
        id: emailJob.id
      },
      data: {
        status: "failed",
        attempts: {
          increment: 1
        },
        error: errorMessage(error)
      }
    });

    throw error;
  }
}
