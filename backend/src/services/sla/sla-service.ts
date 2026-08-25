import type { Priority } from "@prisma/client";
import {
  addBusinessMinutes,
  businessMinutesBetween,
  holidayDatesFromRows,
} from "./business-hours.js";
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

export type SlaEvaluationContext = {
  now: Date;
  holidayDates: ReadonlySet<string>;
  timezone: string;
};

/**
 * ON_TRACK: consumed ratio is 0%–75% inclusive.
 * AT_RISK: consumed ratio is strictly greater than 75% and the deadline has not passed.
 * BREACHED: remaining business minutes are 0 or the as-of instant is at/after the due time.
 */
const AT_RISK_THRESHOLD = 0.75;

export function createSlaContext(input: {
  now?: Date;
  holidays: readonly { date: Date }[];
  timezone: string;
}): SlaEvaluationContext {
  return {
    now: input.now ?? new Date(),
    holidayDates: holidayDatesFromRows(input.holidays),
    timezone: input.timezone,
  };
}

function clockState(
  consumedMinutes: number,
  budgetMinutes: number,
  remainingMinutes: number,
): SlaState {
  if (remainingMinutes <= 0) {
    return "BREACHED";
  }
  if (consumedMinutes / budgetMinutes > AT_RISK_THRESHOLD) {
    return "AT_RISK";
  }
  return "ON_TRACK";
}

function evaluateClock(
  start: Date,
  freezeAt: Date | null,
  budgetMinutes: number,
  context: SlaEvaluationContext,
): { dueAt: Date; state: SlaState; remainingMinutes: number } {
  const dueAt = addBusinessMinutes(
    start,
    budgetMinutes,
    context.holidayDates,
    context.timezone,
  );
  const asOf = freezeAt ?? context.now;
  const consumedMinutes = Math.min(
    budgetMinutes,
    businessMinutesBetween(start, asOf, context.holidayDates, context.timezone),
  );

  if (freezeAt !== null) {
    const remainingAtFreeze = businessMinutesBetween(
      freezeAt,
      dueAt,
      context.holidayDates,
      context.timezone,
    );
    return {
      dueAt,
      state: remainingAtFreeze <= 0 ? "BREACHED" : "ON_TRACK",
      remainingMinutes: 0,
    };
  }

  const remainingMinutes = businessMinutesBetween(
    asOf,
    dueAt,
    context.holidayDates,
    context.timezone,
  );

  return {
    dueAt,
    state: clockState(consumedMinutes, budgetMinutes, remainingMinutes),
    remainingMinutes,
  };
}

export function evaluateSla(ticket: SlaTicket, context: SlaEvaluationContext): SlaInfo {
  const policy = SLA_POLICIES[ticket.priority];
  const firstResponse = evaluateClock(
    ticket.createdAt,
    ticket.firstResponseAt,
    policy.firstResponseMinutes,
    context,
  );
  const resolution = evaluateClock(
    ticket.createdAt,
    ticket.resolvedAt,
    policy.resolutionMinutes,
    context,
  );

  return {
    firstResponseDueAt: firstResponse.dueAt,
    resolutionDueAt: resolution.dueAt,
    firstResponseState: firstResponse.state,
    resolutionState: resolution.state,
    firstResponseRemainingMinutes: firstResponse.remainingMinutes,
    resolutionRemainingMinutes: resolution.remainingMinutes,
  };
}
