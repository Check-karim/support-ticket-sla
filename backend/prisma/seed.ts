import { PrismaClient, type Priority, type TicketStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { hashPassword } from "../src/services/auth/password.js";

const prisma = new PrismaClient();
const SEED_PASSWORD = "password123";
const TZ = "Asia/Kolkata";

function ist(date: string, time: string): Date {
  const zoned = DateTime.fromISO(`${date}T${time}`, { zone: TZ });
  if (!zoned.isValid) {
    throw new Error(`Invalid IST datetime ${date} ${time}`);
  }
  return zoned.toJSDate();
}

async function seed(): Promise<void> {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const reporter = await prisma.user.upsert({
    where: { email: "reporter@example.com" },
    update: {},
    create: {
      name: "Alex Reporter",
      email: "reporter@example.com",
      passwordHash,
      role: "REPORTER",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      name: "Sam Agent",
      email: "agent@example.com",
      passwordHash,
      role: "AGENT",
    },
  });

  await prisma.holiday.upsert({
    where: { date: new Date("2026-08-15T00:00:00.000Z") },
    update: { name: "Independence Day" },
    create: {
      date: new Date("2026-08-15T00:00:00.000Z"),
      name: "Independence Day",
    },
  });

  await prisma.holiday.upsert({
    where: { date: new Date("2026-08-24T00:00:00.000Z") },
    update: { name: "Sample weekday holiday" },
    create: {
      date: new Date("2026-08-24T00:00:00.000Z"),
      name: "Sample weekday holiday",
    },
  });

  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();

  const tickets: {
    title: string;
    description: string;
    priority: Priority;
    status: TicketStatus;
    createdAt: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    assigneeId: string | null;
  }[] = [
    {
      title: "Payment failed",
      description: "Checkout returns an error for saved cards.",
      priority: "URGENT",
      status: "IN_PROGRESS",
      createdAt: ist("2026-08-25", "10:00:00"),
      firstResponseAt: null,
      resolvedAt: null,
      assigneeId: agent.id,
    },
    {
      title: "Login issue",
      description: "SSO redirect loops for some tenants.",
      priority: "HIGH",
      status: "OPEN",
      createdAt: ist("2026-08-25", "09:00:00"),
      firstResponseAt: null,
      resolvedAt: null,
      assigneeId: null,
    },
    {
      title: "Export is slow",
      description: "CSV export takes several minutes for large accounts.",
      priority: "MEDIUM",
      status: "OPEN",
      createdAt: ist("2026-08-21", "17:00:00"),
      firstResponseAt: ist("2026-08-25", "10:30:00"),
      resolvedAt: null,
      assigneeId: agent.id,
    },
    {
      title: "UI typo on settings",
      description: "The timezone label is misspelled.",
      priority: "LOW",
      status: "RESOLVED",
      createdAt: ist("2026-08-20", "11:00:00"),
      firstResponseAt: ist("2026-08-20", "11:20:00"),
      resolvedAt: ist("2026-08-20", "15:00:00"),
      assigneeId: agent.id,
    },
  ];

  for (const ticket of tickets) {
    await prisma.ticket.create({
      data: {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        reporterId: reporter.id,
        assigneeId: ticket.assigneeId,
        createdAt: ticket.createdAt,
        firstResponseAt: ticket.firstResponseAt,
        resolvedAt: ticket.resolvedAt,
      },
    });
  }
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
