import { Router } from "express";
import {
  getMe,
  handleGoogleCallback,
  loginController,
  logout,
  redirectToGoogle
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const authRouter = Router();

authRouter.get("/google", redirectToGoogle);
authRouter.get("/google/callback", handleGoogleCallback);
authRouter.post("/login", asyncHandler(loginController));
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/logout", requireAuth, logout);
