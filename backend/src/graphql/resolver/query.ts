import type { Priority, TicketStatus, UserRole } from "@prisma/client";
import type { GraphQLContext } from "../context.js";
import { resolveOrThrow } from "../errors.js";
import { getDashboard } from "../../services/dashboard/dashboard-service.js";
import { listHolidays } from "../../services/holiday/holiday-service.js";
import type { SlaState } from "../../services/sla/sla-service.js";
import {
  getTicketById,
  listTickets,
} from "../../services/ticket/ticket-service.js";
import { listUsers } from "../../services/user/user-service.js";

export const queryResolvers = {
  tickets: (
    _parent: unknown,
    args: {
      status?: TicketStatus | null;
      priority?: Priority | null;
      assigneeId?: string | null;
      slaState?: SlaState | null;
      take?: number | null;
      cursor?: string | null;
    },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      listTickets(context.prisma, {
        status: args.status,
        priority: args.priority,
        assigneeId: args.assigneeId,
        slaState: args.slaState,
        take: args.take,
        cursor: args.cursor,
      }),
    ),

  ticket: (_parent: unknown, args: { id: string }, context: GraphQLContext) =>
    resolveOrThrow(() => getTicketById(context.prisma, args.id)),

  dashboard: (_parent: unknown, _args: unknown, context: GraphQLContext) =>
    resolveOrThrow(() => getDashboard(context.prisma)),

  users: (
    _parent: unknown,
    args: { role?: UserRole | null },
    context: GraphQLContext,
  ) => resolveOrThrow(() => listUsers(context.prisma, args.role)),

  holidays: (_parent: unknown, _args: unknown, context: GraphQLContext) =>
    resolveOrThrow(() => listHolidays(context.prisma)),
};
