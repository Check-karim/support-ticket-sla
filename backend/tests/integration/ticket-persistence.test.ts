import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../src/services/auth/password.js";
import { register } from "../../src/services/auth/auth-service.js";
import { createSlaContext, evaluateSla } from "../../src/services/sla/sla-service.js";
import { addComment, createTicket } from "../../src/services/ticket/ticket-commands.js";

const databaseUrl = process.env["DATABASE_URL"];

describe.skipIf(databaseUrl === undefined || databaseUrl === "")(
  "ticket persistence (PostgreSQL)",
  () => {
    const prisma = new PrismaClient();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const reporterEmail = `reporter-${suffix}@example.com`;
    const agentEmail = `agent-${suffix}@example.com`;

    let reporterId = "";
    let agentId = "";
    let ticketId = "";
    let databaseReady = false;

    beforeAll(async () => {
      try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        databaseReady = true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "unknown error";
        throw new Error(
          `PostgreSQL is not reachable via DATABASE_URL. Start it with docker compose (repo-root .env must set POSTGRES_PASSWORD), copy backend/.env.example to backend/.env, run npm run gendb, then retry. Original error: ${message}`,
        );
      }
    });

    afterAll(async () => {
      try {
        if (databaseReady) {
          if (ticketId !== "") {
            await prisma.comment.deleteMany({ where: { ticketId } });
            await prisma.ticket.deleteMany({ where: { id: ticketId } });
          }
          await prisma.user.deleteMany({
            where: { email: { in: [reporterEmail, agentEmail] } },
          });
        }
      } finally {
        await prisma.$disconnect().catch(() => undefined);
      }
    });

    it("creates a ticket, records firstResponseAt on the first agent comment, and evaluates SLA from persisted data", async () => {
      const reporterAuth = await register(prisma, {
        name: "Integration Reporter",
        email: reporterEmail,
        password: "password123",
        role: "REPORTER",
      });
      reporterId = reporterAuth.user.id;

      const agent = await prisma.user.create({
        data: {
          name: "Integration Agent",
          email: agentEmail,
          passwordHash: await hashPassword("password123"),
          role: "AGENT",
        },
      });
      agentId = agent.id;

      const ticket = await createTicket(
        prisma,
        { id: reporterId, role: "REPORTER" },
        {
          title: "Payment failed",
          description: "Checkout returns an error for saved cards.",
          priority: "HIGH",
        },
      );
      ticketId = ticket.id;

      expect(ticket.reporter.id).toBe(reporterId);
      expect(ticket.firstResponseAt).toBeNull();
      expect(ticket.resolvedAt).toBeNull();
      expect(ticket.status).toBe("OPEN");

      await addComment(
        prisma,
        { id: reporterId, role: "REPORTER" },
        { ticketId, content: "I still cannot complete checkout." },
      );

      const afterReporterComment = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
      });
      expect(afterReporterComment.firstResponseAt).toBeNull();

      const agentComment = await addComment(
        prisma,
        { id: agentId, role: "AGENT" },
        { ticketId, content: "We are looking into the payment provider logs." },
      );
      expect(agentComment.author.id).toBe(agentId);

      const persisted = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
      });

      expect(persisted.firstResponseAt).not.toBeNull();
      expect(persisted.firstResponseAt?.getTime()).toBeGreaterThanOrEqual(
        persisted.createdAt.getTime(),
      );

      const firstResponseAt = persisted.firstResponseAt;
      await addComment(
        prisma,
        { id: agentId, role: "AGENT" },
        { ticketId, content: "A second agent comment must not change firstResponseAt." },
      );
      const afterSecondAgentComment = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticketId },
      });
      expect(afterSecondAgentComment.firstResponseAt?.getTime()).toBe(firstResponseAt?.getTime());

      const sla = evaluateSla(
        persisted,
        createSlaContext({
          now: persisted.firstResponseAt ?? new Date(),
          holidays: await prisma.holiday.findMany({ select: { date: true } }),
          timezone: process.env["BUSINESS_TIMEZONE"] ?? "Asia/Kolkata",
        }),
      );

      expect(sla.firstResponseDueAt).toBeInstanceOf(Date);
      expect(sla.resolutionDueAt).toBeInstanceOf(Date);
      expect(sla.firstResponseDueAt.getTime()).toBeGreaterThan(persisted.createdAt.getTime());
      expect(sla.resolutionDueAt.getTime()).toBeGreaterThan(sla.firstResponseDueAt.getTime());
      expect(sla.firstResponseRemainingMinutes).toBe(0);
      expect(sla.firstResponseState).toBe("ON_TRACK");
    });
  },
);
