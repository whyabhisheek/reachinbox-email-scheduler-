import type { Request, Response } from "express";
import { env } from "../config/env.js";
import {
  authenticateGoogleCallback,
  createOAuthState,
  createSessionToken,
  getGoogleAuthUrl,
  loginWithEmailAndPassword,
  verifyOAuthState
} from "../services/auth.service.js";
import { loginSchema } from "../validators/auth.validator.js";

const cookieMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const oauthStateCookieName = "reachinbox_oauth_state";
const oauthStateMaxAgeMs = 10 * 60 * 1000;

const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  maxAge: cookieMaxAgeMs,
  path: "/"
};

export function redirectToGoogle(_req: Request, res: Response) {
  const state = createOAuthState();

  res.cookie(oauthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: oauthStateMaxAgeMs,
    path: "/"
  });

  res.redirect(getGoogleAuthUrl(state));
}

export async function handleGoogleCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const storedState = req.cookies?.[oauthStateCookieName] ?? null;

  res.clearCookie(oauthStateCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });

  if (!code) {
    return res.redirect(`${env.CLIENT_URL}/login?error=missing_google_code`);
  }

  if (!verifyOAuthState(state, storedState)) {
    return res.redirect(`${env.CLIENT_URL}/login?error=invalid_oauth_state`);
  }

  try {
    const user = await authenticateGoogleCallback(code);
    const token = createSessionToken(user);

    res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions);
    return res.redirect(`${env.CLIENT_URL}/dashboard`);
  } catch {
    return res.redirect(`${env.CLIENT_URL}/login?error=google_auth_failed`);
  }
}

export function getMe(req: Request, res: Response) {
  return res.json({ user: req.user });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    ...authCookieOptions,
    maxAge: undefined
  });

  return res.status(204).send();
}

function setSessionCookie(res: Response, user: { id: string }) {
  const token = createSessionToken(user);
  res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions);
}

function serializeAuthUser(user: {
  id: string;
  googleId: string | null;
  name: string;
  email: string;
  avatar: string | null;
}) {
  return {
    id: user.id,
    googleId: user.googleId,
    name: user.name,
    email: user.email,
    avatar: user.avatar
  };
}

export async function loginController(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const user = await loginWithEmailAndPassword(input.email, input.password);

  setSessionCookie(res, user);
  return res.json({ user: serializeAuthUser(user) });
}
