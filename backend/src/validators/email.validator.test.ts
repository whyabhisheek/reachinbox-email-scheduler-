import { describe, expect, it } from "vitest";
import { isAllowedAttachmentMimeType, scheduleEmailSchema } from "./email.validator.js";

const futureIso = new Date(Date.now() + 60_000).toISOString();
const base = {
  recipients: ["a@example.com"],
  subject: "Hello",
  body: "World",
  scheduledAt: futureIso
};

describe("scheduleEmailSchema", () => {
  it("accepts a valid payload", () => {
    const result = scheduleEmailSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("coerces startTime into a Date", () => {
    const result = scheduleEmailSchema.safeParse({ ...base, startTime: futureIso });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startTime).toBeInstanceOf(Date);
    }
  });

  it("rejects payloads with no start time", () => {
    const { scheduledAt: _scheduledAt, ...rest } = base;
    const result = scheduleEmailSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("startTime"))).toBe(true);
    }
  });

  it("requires at least one recipient", () => {
    const result = scheduleEmailSchema.safeParse({ ...base, recipients: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid recipient emails", () => {
    const result = scheduleEmailSchema.safeParse({ ...base, recipients: ["not-an-email"] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5000 recipients", () => {
    const recipients = Array.from({ length: 5001 }, (_, index) => `user${index}@example.com`);
    const result = scheduleEmailSchema.safeParse({ ...base, recipients });
    expect(result.success).toBe(false);
  });

  it("rejects negative delayBetweenEmails but accepts zero", () => {
    expect(scheduleEmailSchema.safeParse({ ...base, delayBetweenEmails: -1 }).success).toBe(false);
    expect(scheduleEmailSchema.safeParse({ ...base, delayBetweenEmails: 0 }).success).toBe(true);
  });

  it("rejects a delayBetweenEmails above one hour", () => {
    expect(scheduleEmailSchema.safeParse({ ...base, delayBetweenEmails: 3601 }).success).toBe(false);
    expect(scheduleEmailSchema.safeParse({ ...base, delayBetweenEmails: 3600 }).success).toBe(true);
  });

  it("requires a positive hourlyLimit", () => {
    expect(scheduleEmailSchema.safeParse({ ...base, hourlyLimit: 0 }).success).toBe(false);
    expect(scheduleEmailSchema.safeParse({ ...base, hourlyLimit: 25 }).success).toBe(true);
  });

  it("requires a valid sender email when sender is provided", () => {
    const result = scheduleEmailSchema.safeParse({
      ...base,
      sender: { name: "Sender", email: "invalid" }
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional attachments list", () => {
    const result = scheduleEmailSchema.safeParse({
      ...base,
      attachments: [{ filename: "photo.png", content: "aGVsbG8=" }]
    });
    expect(result.success).toBe(true);
  });

  it("accepts attachment MIME types in the image allowlist", () => {
    const result = scheduleEmailSchema.safeParse({
      ...base,
      attachments: [{ filename: "photo.jpg", content: "aGVsbG8=", contentType: "image/jpeg" }]
    });
    expect(result.success).toBe(true);
  });

  it("rejects attachment MIME types outside the image allowlist", () => {
    const result = scheduleEmailSchema.safeParse({
      ...base,
      attachments: [{ filename: "doc.pdf", content: "aGVsbG8=", contentType: "application/pdf" }]
    });
    expect(result.success).toBe(false);
  });
});

describe("isAllowedAttachmentMimeType", () => {
  it("allows image mime types", () => {
    expect(isAllowedAttachmentMimeType("image/png")).toBe(true);
    expect(isAllowedAttachmentMimeType("image/webp")).toBe(true);
  });

  it("rejects non-image and empty mime types", () => {
    expect(isAllowedAttachmentMimeType("application/pdf")).toBe(false);
    expect(isAllowedAttachmentMimeType("text/html")).toBe(false);
    expect(isAllowedAttachmentMimeType("")).toBe(false);
  });
});
