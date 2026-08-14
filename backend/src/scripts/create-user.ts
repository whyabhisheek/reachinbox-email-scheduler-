import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] ?? email;

  if (!email || !password) {
    throw new Error("Usage: npm run create:user --workspace backend -- email@example.com your-password [name]");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name, passwordHash }
  });

  console.log(`User ready: ${user.email} (id: ${user.id})`);
  console.log(`Login with email "${user.email}" and the password you provided.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
