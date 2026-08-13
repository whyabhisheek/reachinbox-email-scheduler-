import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../config/env.js", () => ({
  env: {
    CLIENT_URL: "http://localhost:5173",
    AUTH_COOKIE_NAME: "reachinbox_session",
    NODE_ENV: "development"
  }
}));

const mocks = vi.hoisted(() => ({
  authenticateGoogleCallback: vi.fn(),
  createOAuthState: vi.fn(),
  createSessionToken: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  loginWithEmailAndPassword: vi.fn(),
  verifyOAuthState: vi.fn()
}));

vi.mock("../services/auth.service.js", () => mocks);

import {
  getMe,
  handleGoogleCallback,
  loginController,
  logout,
  redirectToGoogle
} from "./auth.controller.js";

function mockRes() {
  return {
    redirect: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    json: vi.fn()
  } as unknown as Response;
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return { query: {}, cookies: {}, body: {}, ...overrides } as unknown as Request;
}

describe("redirectToGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOAuthState.mockReturnValue("state-123");
    mocks.getGoogleAuthUrl.mockReturnValue("https://accounts.google.com/auth?state=state-123");
  });

  it("sets an oauth state cookie and redirects to Google with the state", () => {
    const res = mockRes();

    redirectToGoogle(mockReq(), res);

    expect(mocks.createOAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.getGoogleAuthUrl).toHaveBeenCalledWith("state-123");
    expect(res.cookie).toHaveBeenCalledWith(
      "reachinbox_oauth_state",
      "state-123",
      expect.objectContaining({ httpOnly: true, maxAge: 600000 })
    );
    expect(res.redirect).toHaveBeenCalledWith("https://accounts.google.com/auth?state=state-123");
  });
});

describe("handleGoogleCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOAuthState.mockReturnValue(true);
    mocks.authenticateGoogleCallback.mockResolvedValue({ id: "user-1" });
    mocks.createSessionToken.mockReturnValue("token-1");
  });

  it("redirects to login when the code is missing", async () => {
    const res = mockRes();

    await handleGoogleCallback(mockReq(), res);

    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/login?error=missing_google_code"
    );
    expect(mocks.authenticateGoogleCallback).not.toHaveBeenCalled();
  });

  it("redirects to login when the oauth state does not match", async () => {
    mocks.verifyOAuthState.mockReturnValue(false);
    const res = mockRes();

    await handleGoogleCallback(
      mockReq({ query: { code: "code-1", state: "attacker-state" }, cookies: { reachinbox_oauth_state: "real-state" } }),
      res
    );

    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/login?error=invalid_oauth_state"
    );
    expect(mocks.verifyOAuthState).toHaveBeenCalledWith("attacker-state", "real-state");
    expect(mocks.authenticateGoogleCallback).not.toHaveBeenCalled();
  });

  it("clears the oauth state cookie on every callback", async () => {
    const res = mockRes();

    await handleGoogleCallback(
      mockReq({ query: { code: "code-1", state: "state-123" }, cookies: { reachinbox_oauth_state: "state-123" } }),
      res
    );

    expect(res.clearCookie).toHaveBeenCalledWith("reachinbox_oauth_state", expect.any(Object));
  });

  it("authenticates the user and sets the session cookie on success", async () => {
    const res = mockRes();
    mocks.authenticateGoogleCallback.mockResolvedValue({ id: "user-1" });

    await handleGoogleCallback(
      mockReq({ query: { code: "code-1", state: "state-123" }, cookies: { reachinbox_oauth_state: "state-123" } }),
      res
    );

    expect(mocks.verifyOAuthState).toHaveBeenCalledWith("state-123", "state-123");
    expect(mocks.authenticateGoogleCallback).toHaveBeenCalledWith("code-1");
    expect(res.cookie).toHaveBeenCalledWith(
      "reachinbox_session",
      "token-1",
      expect.objectContaining({ httpOnly: true })
    );
    expect(res.redirect).toHaveBeenCalledWith("http://localhost:5173/dashboard");
  });

  it("redirects to login when Google authentication fails", async () => {
    mocks.authenticateGoogleCallback.mockRejectedValue(new Error("google error"));
    const res = mockRes();

    await handleGoogleCallback(
      mockReq({ query: { code: "code-1", state: "state-123" }, cookies: { reachinbox_oauth_state: "state-123" } }),
      res
    );

    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/login?error=google_auth_failed"
    );
  });
});

describe("loginController / logout / getMe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in with email and password and sets the session cookie", async () => {
    const user = { id: "user-1", googleId: null, name: "Test", email: "test@example.com", avatar: null };
    mocks.loginWithEmailAndPassword.mockResolvedValue(user);
    mocks.createSessionToken.mockReturnValue("token-1");
    const res = mockRes();

    await loginController(mockReq({ body: { email: "test@example.com", password: "password123" } }), res);

    expect(mocks.loginWithEmailAndPassword).toHaveBeenCalledWith("test@example.com", "password123");
    expect(res.cookie).toHaveBeenCalledWith("reachinbox_session", "token-1", expect.any(Object));
    expect(res.json).toHaveBeenCalledWith({ user });
  });

  it("clears the session cookie on logout", () => {
    const res = mockRes();

    logout(mockReq(), res);

    expect(res.clearCookie).toHaveBeenCalledWith("reachinbox_session", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("returns the authenticated user from getMe", () => {
    const res = mockRes();
    const req = mockReq({ user: { id: "user-1" } });

    getMe(req, res);

    expect(res.json).toHaveBeenCalledWith({ user: { id: "user-1" } });
  });
});
