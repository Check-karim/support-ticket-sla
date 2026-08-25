import type { Priority, Prisma, PrismaClient, TicketStatus } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";
import { evaluateSla, type SlaState } from "../sla/sla-service.js";

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

export type ListTicketsInput = {
  status: TicketStatus | null | undefined;
  priority: Priority | null | undefined;
  assigneeId: string | null | undefined;
  slaState: SlaState | null | undefined;
  take: number | null | undefined;
  cursor: string | null | undefined;
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

function matchesSlaState(ticket: TicketRecord, slaState: SlaState): boolean {
  const sla = evaluateSla(ticket);
  return sla.firstResponseState === slaState || sla.resolutionState === slaState;
}

export async function listTickets(
  prisma: PrismaClient,
  input: ListTicketsInput,
): Promise<TicketConnection> {
  const take = resolveTake(input.take);
  const where = buildTicketWhere(input);

  if (input.cursor != null && input.cursor.trim() === "") {
    throw new AppError(ErrorCode.INVALID_CURSOR, "Invalid pagination cursor.");
  }

  const decodedCursor = input.cursor ? decodeCursor(input.cursor) : null;
  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const slaState = input.slaState;

  if (slaState == null) {
    const records = await prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy,
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
    orderBy,
  });
  const filtered = records.filter((ticket) => matchesSlaState(ticket, slaState));
  const cursorIndex = decodedCursor
    ? filtered.findIndex((ticket) => ticket.id === decodedCursor.id)
    : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const page = filtered.slice(start, start + take);
  const hasNextPage = filtered.length > start + take;
  const last = page[page.length - 1];

  return {
    nodes: page,
    pageInfo: {
      hasNextPage,
      endCursor: last ? encodeCursor(last) : null,
    },
  };
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
