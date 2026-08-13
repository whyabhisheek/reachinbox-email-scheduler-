import { sendEmail, verifySmtpConnection } from "../services/smtp.service.js";

async function main() {
  const to = process.argv[2];

  if (!to) {
    throw new Error("Usage: npm run test:smtp --workspace backend -- recipient@example.com");
  }

  await verifySmtpConnection();

  const result = await sendEmail({
    fromName: "ReachInbox Scheduler",
    fromEmail: to,
    to,
    subject: "ReachInbox SMTP test",
    body: "This is a test email sent through the configured SMTP service."
  });

  console.log("SMTP test sent.");
  console.log(`Message ID: ${result.messageId}`);
  console.log(`Preview URL: ${result.previewUrl ?? "Not available"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
