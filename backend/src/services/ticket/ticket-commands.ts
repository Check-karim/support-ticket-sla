import type { Priority, PrismaClient, TicketStatus } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";
import { requireNonEmpty } from "../../validation/input.js";
import type { AuthenticatedUser } from "../auth/permissions.js";
import { requireAgent } from "../auth/permissions.js";
import { assertStatusTransition, isReopen } from "./status-transitions.js";
import {
  getTicketById,
  publicUserSelect,
  ticketInclude,
  type TicketRecord,
} from "./ticket-service.js";

const PRIORITIES: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function assertPriority(priority: Priority): Priority {
  if (!PRIORITIES.includes(priority)) {
    throw new AppError(ErrorCode.INVALID_PRIORITY, "priority is invalid.");
  }
  return priority;
}

function assertCanComment(actor: AuthenticatedUser, reporterId: string): void {
  if (actor.role === "AGENT") {
    return;
  }
  if (actor.id !== reporterId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Reporters can only comment on their own tickets.",
    );
  }
}

export async function createTicket(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  input: { title: string; description: string; priority: Priority },
): Promise<TicketRecord> {
  const title = requireNonEmpty(input.title, "title");
  const description = requireNonEmpty(input.description, "description");
  const priority = assertPriority(input.priority);

  return prisma.ticket.create({
    data: {
      title,
      description,
      priority,
      reporterId: actor.id,
    },
    include: ticketInclude,
  });
}

export async function assignTicket(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  input: { ticketId: string; assigneeId: string },
): Promise<TicketRecord> {
  requireAgent(actor);

  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const assigneeId = requireNonEmpty(input.assigneeId, "assigneeId");
  const ticket = await getTicketById(prisma, ticketId);

  if (ticket.status === "CLOSED") {
    throw new AppError(
      ErrorCode.INVALID_STATUS_TRANSITION,
      "Closed tickets cannot be assigned.",
    );
  }

  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, role: true },
  });

  if (assignee === null) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, `User ${assigneeId} was not found.`);
  }
  if (assignee.role !== "AGENT") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Assignee must be an agent.");
  }

  const status = ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status;

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      assigneeId: assignee.id,
      status,
    },
    include: ticketInclude,
  });
}

export async function changeTicketStatus(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  input: { ticketId: string; status: TicketStatus },
): Promise<TicketRecord> {
  requireAgent(actor);

  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const ticket = await getTicketById(prisma, ticketId);
  assertStatusTransition(ticket.status, input.status);

  const data: {
    status: TicketStatus;
    resolvedAt: Date | null;
  } = {
    status: input.status,
    resolvedAt: ticket.resolvedAt,
  };

  if (input.status === "RESOLVED") {
    data.resolvedAt = ticket.resolvedAt ?? new Date();
  } else if (isReopen(ticket.status, input.status)) {
    data.resolvedAt = null;
  }

  return prisma.ticket.update({
    where: { id: ticket.id },
    data,
    include: ticketInclude,
  });
}

export async function resolveTicket(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  ticketId: string,
): Promise<TicketRecord> {
  return changeTicketStatus(prisma, actor, {
    ticketId,
    status: "RESOLVED",
  });
}

export async function addComment(
  prisma: PrismaClient,
  actor: AuthenticatedUser,
  input: { ticketId: string; content: string },
) {
  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const content = input.content.trim();
  if (content === "") {
    throw new AppError(ErrorCode.INVALID_COMMENT, "Comment must not be empty.");
  }

  const ticket = await getTicketById(prisma, ticketId);
  assertCanComment(actor, ticket.reporterId);

  if (ticket.status === "CLOSED") {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Comments cannot be added to a closed ticket.",
    );
  }

  const isFirstResponse =
    ticket.firstResponseAt === null && actor.id !== ticket.reporterId;

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        content,
        ticketId: ticket.id,
        authorId: actor.id,
      },
      include: {
        author: { select: publicUserSelect },
      },
    });

    if (isFirstResponse) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { firstResponseAt: new Date() },
      });
    }

    return created;
  });

  return comment;
}
