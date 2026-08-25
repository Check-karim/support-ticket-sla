import type { Holiday, Prisma } from "@prisma/client";
import type { GraphQLContext } from "../context.js";
import { resolveOrThrow } from "../errors.js";
import { toDateOnlyString, toIsoString } from "../../lib/dates.js";
import { evaluateSla } from "../../services/sla/sla-service.js";
import {
  listTicketComments,
  publicUserSelect,
  type TicketRecord,
} from "../../services/ticket/ticket-service.js";

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

type CommentRecord = Prisma.CommentGetPayload<{
  include: { author: { select: typeof publicUserSelect } };
}>;

export const ticketResolvers = {
  createdAt: (ticket: TicketRecord) => toIsoString(ticket.createdAt),
  firstResponseAt: (ticket: TicketRecord) =>
    ticket.firstResponseAt ? toIsoString(ticket.firstResponseAt) : null,
  resolvedAt: (ticket: TicketRecord) =>
    ticket.resolvedAt ? toIsoString(ticket.resolvedAt) : null,
  sla: (ticket: TicketRecord) => {
    const sla = evaluateSla(ticket);
    return {
      firstResponseDueAt: toIsoString(sla.firstResponseDueAt),
      resolutionDueAt: toIsoString(sla.resolutionDueAt),
      firstResponseState: sla.firstResponseState,
      resolutionState: sla.resolutionState,
      firstResponseRemainingMinutes: sla.firstResponseRemainingMinutes,
      resolutionRemainingMinutes: sla.resolutionRemainingMinutes,
    };
  },
  comments: (ticket: TicketRecord, _args: unknown, context: GraphQLContext) =>
    resolveOrThrow(() => listTicketComments(context.prisma, ticket.id)),
};

export const userResolvers = {
  createdAt: (user: PublicUser) => toIsoString(user.createdAt),
};

export const commentResolvers = {
  createdAt: (comment: CommentRecord) => toIsoString(comment.createdAt),
};

export const holidayResolvers = {
  date: (holiday: Holiday) => toDateOnlyString(holiday.date),
};
