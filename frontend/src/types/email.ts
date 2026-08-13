export type EmailStatus = "scheduled" | "queued" | "processing" | "sent" | "failed";
export type ScheduledEmailStatus = Extract<EmailStatus, "scheduled" | "queued" | "processing">;
export type SentEmailStatus = Extract<EmailStatus, "sent" | "failed">;

export type EmailSender = {
  id: string;
  name: string;
  email: string;
};

export type EmailJob = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  bullmqJobId: string | null;
  attempts: number;
  error: string | null;
  sender: EmailSender;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledEmailJob = EmailJob & {
  status: ScheduledEmailStatus;
};

export type SentEmailJob = EmailJob & {
  status: SentEmailStatus;
};
