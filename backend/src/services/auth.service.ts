import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { User } from "@prisma/client";
import { googleOAuthClient, googleAuthScopes } from "../config/google.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../errors/http-error.js";
import type { AuthenticatedUser, SessionPayload } from "../types/auth.js";

const sessionTtl = "7d";

export function createOAuthState() {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyOAuthState(provided: string | null, stored: string | null) {
  if (!provided || !stored || provided.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(stored));
}

export function getGoogleAuthUrl(state: string) {
  return googleOAuthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: googleAuthScopes,
    state
  });
}

export async function authenticateGoogleCallback(code: string) {
  const { tokens } = await googleOAuthClient.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google did not return an id token.");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.name) {
    throw new Error("Google profile is missing required fields.");
  }

  return prisma.user.upsert({
    where: { googleId: payload.sub },
    update: {
      name: payload.name,
      email: payload.email,
      avatar: payload.picture ?? null
    },
    create: {
      googleId: payload.sub,
      name: payload.name,
      email: payload.email,
      avatar: payload.picture ?? null
    }
  });
}

export function createSessionToken(user: Pick<User, "id">) {
  const payload: SessionPayload = { userId: user.id };
  return jwt.sign(payload, env.JWT_SESSION_SECRET, {
    expiresIn: sessionTtl,
    subject: user.id
  });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, env.JWT_SESSION_SECRET) as SessionPayload;
}

export async function getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleId: true,
      name: true,
      email: true,
      avatar: true
    }
  });

  return user;
}

export async function loginWithEmailAndPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user?.passwordHash) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password.");
  }

  return user;
}
