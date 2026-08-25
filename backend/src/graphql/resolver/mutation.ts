import type { Priority, TicketStatus, UserRole } from "@prisma/client";
import type { GraphQLContext } from "../context.js";
import { resolveOrThrow } from "../errors.js";
import { login, register } from "../../services/auth/auth-service.js";
import { requireUser } from "../../services/auth/permissions.js";
import {
  addComment,
  assignTicket,
  changeTicketStatus,
  createTicket,
  resolveTicket,
} from "../../services/ticket/ticket-commands.js";

export const mutationResolvers = {
  register: (
    _parent: unknown,
    args: { name: string; email: string; password: string; role: UserRole },
    context: GraphQLContext,
  ) => resolveOrThrow(() => register(context.prisma, args)),

  login: (
    _parent: unknown,
    args: { email: string; password: string },
    context: GraphQLContext,
  ) => resolveOrThrow(() => login(context.prisma, args)),

  createTicket: (
    _parent: unknown,
    args: { title: string; description: string; priority: Priority },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      createTicket(context.prisma, requireUser(context.user), args),
    ),

  assignTicket: (
    _parent: unknown,
    args: { ticketId: string; assigneeId: string },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      assignTicket(context.prisma, requireUser(context.user), args),
    ),

  changeTicketStatus: (
    _parent: unknown,
    args: { ticketId: string; status: TicketStatus },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      changeTicketStatus(context.prisma, requireUser(context.user), args),
    ),

  addComment: (
    _parent: unknown,
    args: { ticketId: string; content: string },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      addComment(context.prisma, requireUser(context.user), args),
    ),

  resolveTicket: (
    _parent: unknown,
    args: { ticketId: string },
    context: GraphQLContext,
  ) =>
    resolveOrThrow(() =>
      resolveTicket(context.prisma, requireUser(context.user), args.ticketId),
    ),
};
