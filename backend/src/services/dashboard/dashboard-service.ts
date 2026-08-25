import type { PrismaClient } from "@prisma/client";
import { evaluateSla } from "../sla/sla-service.js";

export type TicketDashboard = {
  openTickets: number;
  inProgressTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
};

export async function getDashboard(prisma: PrismaClient): Promise<TicketDashboard> {
  const [openTickets, inProgressTickets, activeTickets] = await Promise.all([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: {
        priority: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  let atRiskTickets = 0;
  let breachedTickets = 0;

  for (const ticket of activeTickets) {
    const sla = evaluateSla(ticket);
    const states = [sla.firstResponseState, sla.resolutionState];
    if (states.includes("BREACHED")) {
      breachedTickets += 1;
    } else if (states.includes("AT_RISK")) {
      atRiskTickets += 1;
    }
  }

  return {
    openTickets,
    inProgressTickets,
    atRiskTickets,
    breachedTickets,
  };
}
