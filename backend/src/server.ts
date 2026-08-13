import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { redisConnection } from "./config/redis.js";
import { emailQueue } from "./queues/email.queue.js";
import { emailSweeperQueue } from "./queues/email-sweeper.queue.js";
import { startEmailSweeper } from "./workers/email-sweeper.worker.js";

if (env.RUN_EMAIL_WORKER_INLINE) {
  await import("./workers/email.worker.js");
}

const emailSweeperWorker = startEmailSweeper();

const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  server.close(async () => {
    await emailSweeperWorker.close();
    await emailSweeperQueue.close();
    await emailQueue.close();
    await redisConnection.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
