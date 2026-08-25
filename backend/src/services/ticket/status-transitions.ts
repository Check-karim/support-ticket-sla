import type { TicketStatus } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";

/**
 * Status transition rules:
 * OPEN        → IN_PROGRESS, RESOLVED
 * IN_PROGRESS → RESOLVED, OPEN
 * RESOLVED    → CLOSED, OPEN (reopen)
 * CLOSED      → OPEN (reopen only; CLOSED → IN_PROGRESS is rejected)
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
};

export function assertStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
): void {
  if (from === to) {
    throw new AppError(
      ErrorCode.INVALID_STATUS_TRANSITION,
      `Ticket is already ${from}.`,
    );
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new AppError(
      ErrorCode.INVALID_STATUS_TRANSITION,
      `Ticket cannot transition from ${from} to ${to}.`,
    );
  }
}

export function isReopen(from: TicketStatus, to: TicketStatus): boolean {
  return to === "OPEN" && (from === "RESOLVED" || from === "CLOSED");
}
