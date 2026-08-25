import type { Priority } from "@prisma/client";
import { SLA_POLICIES } from "./policies.js";

export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export type SlaInfo = {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseState: SlaState;
  resolutionState: SlaState;
  firstResponseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
};

export type SlaTicket = {
  priority: Priority;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
};

function addMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

/**
 * Placeholder SLA evaluation so Ticket.sla can be served from the API.
 * This uses wall-clock offsets from createdAt, not business hours.
 * The dedicated business-hours engine will replace this implementation.
 */
export function evaluateSla(ticket: SlaTicket): SlaInfo {
  const policy = SLA_POLICIES[ticket.priority];
  const firstResponseDueAt = addMinutes(ticket.createdAt, policy.firstResponseMinutes);
  const resolutionDueAt = addMinutes(ticket.createdAt, policy.resolutionMinutes);

  return {
    firstResponseDueAt,
    resolutionDueAt,
    firstResponseState: "ON_TRACK",
    resolutionState: "ON_TRACK",
    firstResponseRemainingMinutes: ticket.firstResponseAt
      ? 0
      : policy.firstResponseMinutes,
    resolutionRemainingMinutes: ticket.resolvedAt ? 0 : policy.resolutionMinutes,
  };
}
