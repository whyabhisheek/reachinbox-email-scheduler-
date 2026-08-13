import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";

const hourMs = 60 * 60 * 1000;
const counterTtlBufferMs = 5 * 60 * 1000;

type ReservationResult =
  | {
      allowed: true;
      rateKey: string;
      hourlyCount: number;
      nextAllowedAt: Date;
    }
  | {
      allowed: false;
      reason: "hourly_limit" | "minimum_delay";
      retryAt: Date;
      rateKey: string;
      hourlyCount: number;
    };

function getHourWindow(nowMs: number) {
  return Math.floor(nowMs / hourMs);
}

function getHourStartMs(hourWindow: number) {
  return hourWindow * hourMs;
}

function getHourEndMs(hourWindow: number) {
  return getHourStartMs(hourWindow + 1);
}

export function getRateLimitKeys(senderId: string, now = new Date()) {
  const nowMs = now.getTime();
  const hourWindow = getHourWindow(nowMs);

  return {
    rateKey: `email-rate:${senderId}:${hourWindow}`,
    delayKey: `email-delay:${senderId}`,
    hourWindow,
    hourEndMs: getHourEndMs(hourWindow)
  };
}

export async function reserveEmailSendSlot(
  senderId: string,
  options: { now?: Date; maxPerHour?: number } = {}
): Promise<ReservationResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const { rateKey, delayKey, hourEndMs } = getRateLimitKeys(senderId, now);
  const expireAtMs = hourEndMs + counterTtlBufferMs;
  const maxPerHour = Math.min(
    options.maxPerHour ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    env.MAX_EMAILS_PER_HOUR_PER_SENDER
  );

  const result = (await redisConnection.eval(
    `
      local rateKey = KEYS[1]
      local delayKey = KEYS[2]
      local nowMs = tonumber(ARGV[1])
      local minDelayMs = tonumber(ARGV[2])
      local maxPerHour = tonumber(ARGV[3])
      local hourEndMs = tonumber(ARGV[4])
      local expireAtMs = tonumber(ARGV[5])

      local currentCount = tonumber(redis.call("GET", rateKey) or "0")
      if currentCount >= maxPerHour then
        return {0, "hourly_limit", hourEndMs, currentCount}
      end

      local nextAllowedMs = tonumber(redis.call("GET", delayKey) or "0")
      if nextAllowedMs > nowMs then
        return {0, "minimum_delay", nextAllowedMs, currentCount}
      end

      currentCount = redis.call("INCR", rateKey)
      if currentCount == 1 then
        redis.call("PEXPIREAT", rateKey, expireAtMs)
      end

      local newNextAllowedMs = nowMs + minDelayMs
      redis.call("SET", delayKey, newNextAllowedMs, "PX", math.max(minDelayMs + 60000, 60000))

      return {1, "allowed", newNextAllowedMs, currentCount}
    `,
    2,
    rateKey,
    delayKey,
    String(nowMs),
    String(env.MIN_DELAY_BETWEEN_EMAILS_MS),
    String(maxPerHour),
    String(hourEndMs),
    String(expireAtMs)
  )) as [number, string, number, number];

  const [allowedValue, reason, timestampValue, hourlyCountValue] = result;
  const allowed = Number(allowedValue);
  const timestampMs = Number(timestampValue);
  const hourlyCount = Number(hourlyCountValue);

  if (allowed === 1) {
    return {
      allowed: true,
      rateKey,
      hourlyCount,
      nextAllowedAt: new Date(timestampMs)
    };
  }

  return {
    allowed: false,
    reason: reason as "hourly_limit" | "minimum_delay",
    retryAt: new Date(timestampMs),
    rateKey,
    hourlyCount
  };
}
