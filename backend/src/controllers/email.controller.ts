import type { Request, Response } from "express";
import {
  getEmailJobById,
  listScheduledEmails,
  listSentEmails,
  scheduleEmails
} from "../services/email.service.js";
import { emailJobIdSchema, scheduleEmailSchema } from "../validators/email.validator.js";

export async function scheduleEmailController(req: Request, res: Response) {
  // Build input from multipart/form-data fields and uploaded files
  const rawBody: Record<string, unknown> = { ...req.body };

  // Normalize recipients: support recipients[] or recipients
  const recipientsField = (req.body["recipients[]"] ?? req.body.recipients) as
    | string
    | string[]
    | undefined;
  if (recipientsField) {
    rawBody.recipients = Array.isArray(recipientsField)
      ? recipientsField
      : typeof recipientsField === "string"
      ? recipientsField.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  }

  // Map uploaded files to base64 attachments
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length > 0) {
    rawBody.attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer.toString("base64"),
      contentType: f.mimetype
    }));
  }

  const input = scheduleEmailSchema.parse(rawBody);
  const result = await scheduleEmails(req.user!, input);

  return res.status(201).json(result);
}

export async function listScheduledEmailsController(req: Request, res: Response) {
  const jobs = await listScheduledEmails(req.user!);

  return res.json({ jobs });
}

export async function listSentEmailsController(req: Request, res: Response) {
  const jobs = await listSentEmails(req.user!);

  return res.json({ jobs });
}

export async function getEmailJobController(req: Request, res: Response) {
  const id = emailJobIdSchema.parse(req.params.id);
  const job = await getEmailJobById(req.user!, id);

  return res.json({ job });
}
