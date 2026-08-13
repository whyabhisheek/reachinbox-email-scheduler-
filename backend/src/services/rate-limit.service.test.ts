import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../config/redis.js", () => ({
  redisConnection: {
    eval: vi.fn()
  }
}));

import { redisConnection } from "../config/redis.js";
import { getRateLimitKeys, reserveEmailSendSlot } from "./rate-limit.service.js";

const mockedEval = redisConnection.eval as Mock;

const fixedNow = new Date("2026-01-01T12:00:00.000Z");

describe("getRateLimitKeys", () => {
  it("builds the expected Redis keys and hour window", () => {
    const nowMs = fixedNow.getTime();
    const hourWindow = Math.floor(nowMs / (60 * 60 * 1000));

    const keys = getRateLimitKeys("sender-1", fixedNow);

    expect(keys.rateKey).toBe(`email-rate:sender-1:${hourWindow}`);
    expect(keys.delayKey).toBe("email-delay:sender-1");
    expect(keys.hourWindow).toBe(hourWindow);
    expect(keys.hourEndMs).toBe((hourWindow + 1) * 60 * 60 * 1000);
  });
});

describe("reserveEmailSendSlot", () => {
  beforeEach(() => {
    mockedEval.mockReset();
  });

  it("returns an allowed reservation", async () => {
    const nowMs = fixedNow.getTime();
    mockedEval.mockResolvedValue([1, "allowed", nowMs + 2000, 3]);

    const result = await reserveEmailSendSlot("sender-1", { now: fixedNow });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.hourlyCount).toBe(3);
      expect(result.nextAllowedAt.getTime()).toBe(nowMs + 2000);
      expect(result.rateKey).toBe(getRateLimitKeys("sender-1", fixedNow).rateKey);
    }
  });

  it("denies when the hourly limit is reached", async () => {
    const { hourEndMs } = getRateLimitKeys("sender-1", fixedNow);
    mockedEval.mockResolvedValue([0, "hourly_limit", hourEndMs, 100]);

    const result = await reserveEmailSendSlot("sender-1", { now: fixedNow });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("hourly_limit");
      expect(result.retryAt.getTime()).toBe(hourEndMs);
      expect(result.hourlyCount).toBe(100);
    }
  });

  it("denies when the minimum delay between emails is active", async () => {
    const nowMs = fixedNow.getTime();
    mockedEval.mockResolvedValue([0, "minimum_delay", nowMs + 5000, 5]);

    const result = await reserveEmailSendSlot("sender-1", { now: fixedNow });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("minimum_delay");
      expect(result.retryAt.getTime()).toBe(nowMs + 5000);
    }
  });

  it("caps maxPerHour to the environment default", async () => {
    mockedEval.mockResolvedValue([1, "allowed", 0, 1]);

    await reserveEmailSendSlot("sender-1", { now: fixedNow, maxPerHour: 5000 });

    const args = mockedEval.mock.calls[0];
    expect(args).toBeDefined();
    const [, keyCount, , , , , maxPerHourArg] = args as unknown as [
      string,
      number,
      string,
      string,
      string,
      string,
      string,
      string
    ];
    expect(keyCount).toBe(2);
    expect(maxPerHourArg).toBe("100");
  });

  it("passes the sender rate/delay keys and delay window to the Lua script", async () => {
    mockedEval.mockResolvedValue([1, "allowed", 0, 1]);
    const { rateKey, delayKey, hourEndMs } = getRateLimitKeys("sender-1", fixedNow);

    await reserveEmailSendSlot("sender-1", { now: fixedNow });

    const args = mockedEval.mock.calls[0] as unknown as [
      string,
      number,
      string,
      string,
      string,
      string,
      string,
      string
    ];
    const [, keyCount, passedRateKey, passedDelayKey, nowMsArg, minDelayArg, maxPerHourArg, passedHourEndMs] =
      args;
    expect(keyCount).toBe(2);
    expect(passedRateKey).toBe(rateKey);
    expect(passedDelayKey).toBe(delayKey);
    expect(nowMsArg).toBe(String(fixedNow.getTime()));
    expect(minDelayArg).toBe("2000");
    expect(maxPerHourArg).toBe("100");
    expect(passedHourEndMs).toBe(String(hourEndMs));
  });
});
