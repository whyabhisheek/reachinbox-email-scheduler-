import { Router } from "express";
import {
  getEmailJobController,
  listScheduledEmailsController,
  listSentEmailsController,
  scheduleEmailController
} from "../controllers/email.controller.js";
import multer from "multer";
import { HttpError } from "../errors/http-error.js";
import { isAllowedAttachmentMimeType } from "../validators/email.validator.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachmentMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new HttpError(
          400,
          `File type ${file.mimetype} is not allowed. Only image files are accepted.`
        )
      );
    }
  }
});
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const emailRouter = Router();

emailRouter.use(requireAuth);

emailRouter.post("/schedule", upload.array("attachments"), asyncHandler(scheduleEmailController));
emailRouter.get("/scheduled", asyncHandler(listScheduledEmailsController));
emailRouter.get("/sent", asyncHandler(listSentEmailsController));
emailRouter.get("/:id", asyncHandler(getEmailJobController));
