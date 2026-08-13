import nodemailer, { type SendMailOptions, type SentMessageInfo } from "nodemailer";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";

export type AttachmentInput = {
  filename: string;
  content: string;
  contentType?: string;
};

type SendEmailInput = {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  attachments?: AttachmentInput[] | null;
};

const attachmentSchema = z.object({
  filename: z.string(),
  content: z.string(),
  contentType: z.string().optional()
});

export function parseAttachmentInput(value: unknown): AttachmentInput[] | null {
  return z.array(attachmentSchema).nullable().parse(value ?? null);
}

function assertSmtpConfigured() {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new HttpError(
      500,
      "SMTP credentials are not configured. Set SMTP_USER and SMTP_PASSWORD."
    );
  }
}

export function createSmtpTransporter() {
  assertSmtpConfigured();

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });
}

function getFromAddress(input: SendEmailInput) {
  return env.SMTP_FROM ?? {
    name: input.fromName,
    address: input.fromEmail
  };
}

export function getPreviewUrl(info: SentMessageInfo) {
  return nodemailer.getTestMessageUrl(info) || null;
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = createSmtpTransporter();

  try {
    // If the body already looks like HTML, send as-is. Otherwise convert newlines to <br/> to preserve structure.
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input.body);
    const htmlBody = looksLikeHtml ? input.body : input.body.replace(/\r?\n/g, "<br/>");

    const mailOptions: SendMailOptions = {
      from: getFromAddress(input),
      to: input.to,
      subject: input.subject,
      html: htmlBody,
      text: looksLikeHtml ? undefined : input.body
    };

    if (input.attachments && input.attachments.length > 0) {
      mailOptions.attachments = input.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.contentType
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    return {
      messageId: info.messageId,
      accepted: info.accepted ?? [],
      rejected: info.rejected ?? [],
      response: info.response,
      previewUrl: getPreviewUrl(info)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error.";
    throw new Error(`SMTP send failed: ${message}`);
  }
}

export async function verifySmtpConnection() {
  const transporter = createSmtpTransporter();

  try {
    await transporter.verify();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP connection error.";
    throw new Error(`SMTP verification failed: ${message}`);
  }
}
