import type { Priority } from "@prisma/client";

export type SlaPolicy = {
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export const SLA_POLICIES: Record<Priority, SlaPolicy> = {
  URGENT: { firstResponseMinutes: 60, resolutionMinutes: 4 * 60 },
  HIGH: { firstResponseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  MEDIUM: { firstResponseMinutes: 8 * 60, resolutionMinutes: 48 * 60 },
  LOW: { firstResponseMinutes: 24 * 60, resolutionMinutes: 72 * 60 },
};
