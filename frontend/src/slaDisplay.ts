import type { SLAInfo, SLAState } from "./types.js";

const STATE_RANK: Record<SLAState, number> = {
  ON_TRACK: 0,
  AT_RISK: 1,
  BREACHED: 2,
};

export type SlaSummary = {
  state: SLAState;
  remainingMinutes: number;
};

export function slaSummary(sla: SLAInfo): SlaSummary {
  const first = {
    state: sla.firstResponseState,
    remainingMinutes: sla.firstResponseRemainingMinutes,
  };
  const resolution = {
    state: sla.resolutionState,
    remainingMinutes: sla.resolutionRemainingMinutes,
  };
  if (STATE_RANK[first.state] === STATE_RANK[resolution.state]) {
    return first.remainingMinutes <= resolution.remainingMinutes ? first : resolution;
  }
  return STATE_RANK[first.state] > STATE_RANK[resolution.state] ? first : resolution;
}

export function slaLabel(summary: SlaSummary): string {
  if (summary.state === "BREACHED") {
    return "Breached";
  }
  if (summary.state === "AT_RISK") {
    return `At risk — ${formatMinutes(summary.remainingMinutes)}`;
  }
  if (summary.remainingMinutes === 0) {
    return "Met";
  }
  return `On track — ${formatMinutes(summary.remainingMinutes)}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}
