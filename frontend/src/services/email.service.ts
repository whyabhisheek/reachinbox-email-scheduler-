import { apiRequest } from "./api";
import type { EmailJob, ScheduledEmailJob, SentEmailJob } from "../types/email";

export type ScheduleEmailsRequest = {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
};

export async function getScheduledEmails() {
  return apiRequest<{ jobs: ScheduledEmailJob[] }>("/api/emails/scheduled");
}

export async function getSentEmails() {
  return apiRequest<{ jobs: SentEmailJob[] }>("/api/emails/sent");
}

export async function scheduleEmails(payload: ScheduleEmailsRequest | FormData) {
  const options: RequestInit = { method: "POST" };

  if (payload instanceof FormData) {
    options.body = payload;
  } else {
    options.body = JSON.stringify(payload);
    options.headers = { "Content-Type": "application/json" };
  }

  return apiRequest<{ count: number; jobs: EmailJob[] }>("/api/emails/schedule", options);
}
