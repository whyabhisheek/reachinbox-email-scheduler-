import { z } from "zod";

const trimmedString = z.string().trim();

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff"
] as const;

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const scheduleEmailSchema = z.object({
  sender: z
    .object({
      name: trimmedString.min(1, "Sender name is required.").max(120),
      email: trimmedString.email("Sender email is invalid.").max(254)
    })
    .optional(),
  senderId: z.string().min(1).optional(),
  recipients: z
    .array(trimmedString.email("Recipient email is invalid.").max(254))
    .min(1, "At least one recipient is required.")
    .max(5000, "A maximum of 5000 recipients can be scheduled in one request."),
  subject: trimmedString.min(1, "Subject is required.").max(300),
  body: trimmedString.min(1, "Body is required.").max(10000),
  scheduledAt: z.coerce.date().optional(),
  startTime: z.coerce.date().optional(),
  delayBetweenEmails: z
    .coerce.number()
    .int()
    .nonnegative()
    .max(3600, "Delay between emails must be at most 3600 seconds.")
    .optional(),
  hourlyLimit: z.coerce.number().int().positive().optional()
  ,
  attachments: z
    .array(
      z.object({
        filename: trimmedString,
        content: trimmedString,
        contentType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES).optional()
      })
    )
    .optional()
}).superRefine((value, context) => {
  if (!value.scheduledAt && !value.startTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start time is required.",
      path: ["startTime"]
    });
  }
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;

export const emailJobIdSchema = z.string().min(1, "Email job id is required.");
