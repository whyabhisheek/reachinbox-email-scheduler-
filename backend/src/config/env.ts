import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
  JWT_SESSION_SECRET: z.string().min(32),
  AUTH_COOKIE_NAME: z.string().default("reachinbox_session"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  EMAIL_QUEUE_NAME: z.string().default("email-send-queue"),
  EMAIL_SWEEPER_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  EMAIL_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  EMAIL_JOB_BACKOFF_MS: z.coerce.number().int().nonnegative().default(5000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(100),
  SMTP_HOST: z.string().default("smtp.ethereal.email"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = envSchema.parse(process.env);
