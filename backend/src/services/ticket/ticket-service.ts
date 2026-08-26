import type { Priority, Prisma, PrismaClient, TicketStatus } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";
import { evaluateSla, type SlaEvaluationContext, type SlaState } from "../sla/sla-service.js";

export const DEFAULT_TICKET_PAGE_SIZE = 20;
export const MAX_TICKET_PAGE_SIZE = 100;

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export const ticketInclude = {
  reporter: { select: publicUserSelect },
  assignee: { select: publicUserSelect },
} as const;

export type TicketRecord = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

export type TicketConnection = {
  nodes: TicketRecord[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type TicketSort =
  | "CREATED_AT_DESC"
  | "CREATED_AT_ASC"
  | "PRIORITY_DESC"
  | "PRIORITY_ASC"
  | "SLA_REMAINING_ASC"
  | "SLA_REMAINING_DESC";

export type ListTicketsInput = {
  status: TicketStatus | null | undefined;
  priority: Priority | null | undefined;
  assigneeId: string | null | undefined;
  slaState: SlaState | null | undefined;
  take: number | null | undefined;
  cursor: string | null | undefined;
  sort: TicketSort | null | undefined;
};

type TicketCursor = {
  id: string;
  createdAt: string;
};

function encodeCursor(ticket: TicketRecord): string {
  const payload: TicketCursor = {
    id: ticket.id,
    createdAt: ticket.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): TicketCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (!isTicketCursor(parsed)) {
      throw new Error("Invalid cursor payload");
    }
    return parsed;
  } catch {
    throw new AppError(ErrorCode.INVALID_CURSOR, "Invalid pagination cursor.");
  }
}

function isTicketCursor(value: unknown): value is TicketCursor {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("id" in value) || !("createdAt" in value)) {
    return false;
  }
  return typeof value.id === "string" && typeof value.createdAt === "string";
}

function resolveTake(take: number | null | undefined): number {
  if (take == null) {
    return DEFAULT_TICKET_PAGE_SIZE;
  }
  if (!Number.isInteger(take) || take < 1 || take > MAX_TICKET_PAGE_SIZE) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `take must be an integer between 1 and ${MAX_TICKET_PAGE_SIZE}.`,
    );
  }
  return take;
}

function buildTicketWhere(input: ListTicketsInput): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};

  if (input.status != null) {
    where.status = input.status;
  }
  if (input.priority != null) {
    where.priority = input.priority;
  }
  if (input.assigneeId != null) {
    if (input.assigneeId.trim() === "") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "assigneeId must not be empty.");
    }
    where.assigneeId = input.assigneeId;
  }

  return where;
}

function matchesSlaState(
  ticket: TicketRecord,
  slaState: SlaState,
  sla: SlaEvaluationContext,
): boolean {
  const info = evaluateSla(ticket, sla);
  return info.firstResponseState === slaState || info.resolutionState === slaState;
}

const PRIORITY_RANK: Record<Priority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

function slaRemaining(ticket: TicketRecord, sla: SlaEvaluationContext): number {
  const info = evaluateSla(ticket, sla);
  return Math.min(info.firstResponseRemainingMinutes, info.resolutionRemainingMinutes);
}

function compareTickets(
  left: TicketRecord,
  right: TicketRecord,
  sort: TicketSort,
  sla: SlaEvaluationContext,
): number {
  switch (sort) {
    case "CREATED_AT_ASC":
      return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
    case "CREATED_AT_DESC":
      return right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
    case "PRIORITY_ASC":
      return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] || left.id.localeCompare(right.id);
    case "PRIORITY_DESC":
      return PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority] || left.id.localeCompare(right.id);
    case "SLA_REMAINING_ASC":
      return slaRemaining(left, sla) - slaRemaining(right, sla) || left.id.localeCompare(right.id);
    case "SLA_REMAINING_DESC":
      return slaRemaining(right, sla) - slaRemaining(left, sla) || left.id.localeCompare(right.id);
  }
}

function paginateInMemory(
  records: TicketRecord[],
  take: number,
  cursorId: string | null,
): TicketConnection {
  const cursorIndex = cursorId ? records.findIndex((ticket) => ticket.id === cursorId) : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const page = records.slice(start, start + take);
  const last = page[page.length - 1];
  return {
    nodes: page,
    pageInfo: {
      hasNextPage: records.length > start + take,
      endCursor: last ? encodeCursor(last) : null,
    },
  };
}

export async function listTickets(
  prisma: PrismaClient,
  input: ListTicketsInput,
  sla: SlaEvaluationContext,
): Promise<TicketConnection> {
  const take = resolveTake(input.take);
  const where = buildTicketWhere(input);
  const sort: TicketSort = input.sort ?? "CREATED_AT_DESC";

  if (input.cursor != null && input.cursor.trim() === "") {
    throw new AppError(ErrorCode.INVALID_CURSOR, "Invalid pagination cursor.");
  }

  const decodedCursor = input.cursor ? decodeCursor(input.cursor) : null;
  const createdAtOrder = sort === "CREATED_AT_ASC" ? "asc" : "desc";
  const orderBy = [
    { createdAt: createdAtOrder },
    { id: createdAtOrder },
  ] as const;
  const slaState = input.slaState;
  const needsMemorySort =
    slaState != null || sort === "PRIORITY_ASC" || sort === "PRIORITY_DESC" || sort.startsWith("SLA_");

  if (!needsMemorySort) {
    const records = await prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: [...orderBy],
      take: take + 1,
      ...(decodedCursor ? { cursor: { id: decodedCursor.id }, skip: 1 } : {}),
    });

    const hasNextPage = records.length > take;
    const page = hasNextPage ? records.slice(0, take) : records;
    const last = page[page.length - 1];

    return {
      nodes: page,
      pageInfo: {
        hasNextPage,
        endCursor: last ? encodeCursor(last) : null,
      },
    };
  }

  const records = await prisma.ticket.findMany({
    where,
    include: ticketInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const filtered =
    slaState == null
      ? records
      : records.filter((ticket) => matchesSlaState(ticket, slaState, sla));
  filtered.sort((left, right) => compareTickets(left, right, sort, sla));
  return paginateInMemory(filtered, take, decodedCursor?.id ?? null);
}

export async function getTicketById(
  prisma: PrismaClient,
  id: string,
): Promise<TicketRecord> {
  if (id.trim() === "") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Ticket id must not be empty.");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: ticketInclude,
  });

  if (!ticket) {
    throw new AppError(ErrorCode.TICKET_NOT_FOUND, `Ticket ${id} was not found.`);
  }

  return ticket;
}

export async function listTicketComments(prisma: PrismaClient, ticketId: string) {
  return prisma.comment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: publicUserSelect },
    },
  });
}
