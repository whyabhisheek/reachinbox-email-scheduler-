import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { getAuthenticatedUser, verifySessionToken } from "../services/auth.service.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = verifySessionToken(token);
    const user = await getAuthenticatedUser(payload.userId);

    if (!user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Authentication required." });
  }
}
