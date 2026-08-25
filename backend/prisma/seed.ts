import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/services/auth/password.js";

const prisma = new PrismaClient();
const SEED_PASSWORD = "password123";

async function seed(): Promise<void> {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await prisma.user.upsert({
    where: { email: "reporter@example.com" },
    update: {},
    create: {
      name: "Alex Reporter",
      email: "reporter@example.com",
      passwordHash,
      role: "REPORTER",
    },
  });

  await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      name: "Sam Agent",
      email: "agent@example.com",
      passwordHash,
      role: "AGENT",
    },
  });
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
