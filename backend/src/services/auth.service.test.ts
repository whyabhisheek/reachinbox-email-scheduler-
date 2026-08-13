import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

import { prisma } from "../config/prisma.js";
import {
  createOAuthState,
  createSessionToken,
  getGoogleAuthUrl,
  loginWithEmailAndPassword,
  verifyOAuthState,
  verifySessionToken
} from "./auth.service.js";

const userWithPassword = {
  id: "user-1",
  googleId: null,
  name: "Test User",
  email: "test@example.com",
  avatar: null,
  passwordHash: bcrypt.hashSync("password123", 10)
};

describe("loginWithEmailAndPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user on a valid login", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(userWithPassword);

    const user = await loginWithEmailAndPassword("Test@Example.com", "password123");

    expect(user.id).toBe("user-1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" }
    });
  });

  it("rejects an unknown email with 401", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(loginWithEmailAndPassword("nobody@example.com", "password123")).rejects.toMatchObject(
      { statusCode: 401, message: "Invalid email or password." }
    );
  });

  it("rejects users without a password hash with 401", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ ...userWithPassword, passwordHash: null });

    await expect(loginWithEmailAndPassword("test@example.com", "password123")).rejects.toMatchObject(
      { statusCode: 401 }
    );
  });

  it("rejects a wrong password with 401", async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(userWithPassword);

    await expect(loginWithEmailAndPassword("test@example.com", "wrong-password")).rejects.toMatchObject(
      { statusCode: 401 }
    );
  });
});

describe("session tokens", () => {
  it("round-trips a session token back to the user id", () => {
    const token = createSessionToken({ id: "user-1" });
    const payload = verifySessionToken(token);

    expect(payload.userId).toBe("user-1");
  });

  it("rejects tokens signed with a different secret", () => {
    const foreignToken = jwt.sign({ userId: "attacker" }, "some-other-secret-12345678901234567890");

    expect(() => verifySessionToken(foreignToken)).toThrow();
  });
});

describe("OAuth state", () => {
  it("creates a unique random state value", () => {
    const first = createOAuthState();
    const second = createOAuthState();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it("verifies a matching state", () => {
    const state = createOAuthState();

    expect(verifyOAuthState(state, state)).toBe(true);
  });

  it("rejects a mismatched, missing, or differently sized state", () => {
    const state = createOAuthState();

    expect(verifyOAuthState("different-value", state)).toBe(false);
    expect(verifyOAuthState(null, state)).toBe(false);
    expect(verifyOAuthState(state, null)).toBe(false);
    expect(verifyOAuthState("", "")).toBe(false);
    expect(verifyOAuthState(state.slice(0, 16), state)).toBe(false);
  });

  it("includes the state in the Google authorization URL", () => {
    const state = createOAuthState();
    const url = new URL(getGoogleAuthUrl(state));

    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});
