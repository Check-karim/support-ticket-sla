import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AppError, ErrorCode } from "../../src/errors.js";
import { register } from "../../src/services/auth/auth-service.js";
import {
  addComment,
  assignTicket,
  createTicket,
  resolveTicket,
} from "../../src/services/ticket/ticket-commands.js";

const reporter = { id: "reporter-1", role: "REPORTER" as const };
const agent = { id: "agent-1", role: "AGENT" as const };

describe("ticket command validation", () => {
  it("rejects an empty ticket title", async () => {
    const create = vi.fn();
    const prisma = { ticket: { create } } as unknown as PrismaClient;

    await expect(
      createTicket(prisma, reporter, {
        title: "   ",
        description: "Something broke",
        priority: "HIGH",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an empty ticket description", async () => {
    const create = vi.fn();
    const prisma = { ticket: { create } } as unknown as PrismaClient;

    await expect(
      createTicket(prisma, reporter, {
        title: "Login issue",
        description: "",
        priority: "HIGH",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an empty comment", async () => {
    const findUnique = vi.fn();
    const prisma = { ticket: { findUnique } } as unknown as PrismaClient;

    await expect(
      addComment(prisma, reporter, { ticketId: "ticket-1", content: "   " }),
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_COMMENT });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("forbids a reporter from assigning a ticket", async () => {
    const findUnique = vi.fn();
    const prisma = { ticket: { findUnique }, user: { findUnique } } as unknown as PrismaClient;

    await expect(
      assignTicket(prisma, reporter, { ticketId: "ticket-1", assigneeId: "agent-1" }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("forbids a reporter from resolving a ticket", async () => {
    const findUnique = vi.fn();
    const prisma = { ticket: { findUnique } } as unknown as PrismaClient;

    await expect(resolveTicket(prisma, reporter, "ticket-1")).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("forbids self-registration as an agent", async () => {
    const create = vi.fn();
    const prisma = { user: { create } } as unknown as PrismaClient;

    await expect(
      register(prisma, {
        name: "Sam",
        email: "agent@example.com",
        password: "password123",
        role: "AGENT",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("ticket command authorization types", () => {
  it("uses AppError codes for forbidden agent work", async () => {
    const prisma = {} as PrismaClient;
    try {
      await assignTicket(prisma, reporter, { ticketId: "t", assigneeId: "a" });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }

    expect(agent.role).toBe("AGENT");
  });
});
