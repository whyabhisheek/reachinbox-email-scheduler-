-- Prevent duplicate email jobs created by concurrent schedule requests.
-- Uses md5(body) because a b-tree unique index on the full text body would
-- exceed PostgreSQL's index row size limit for long emails.
CREATE UNIQUE INDEX "email_jobs_dedup_key"
ON "EmailJob" ("userId", "senderId", "recipient", "subject", md5("body"), "scheduledAt");
