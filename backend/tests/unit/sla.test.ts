import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { addBusinessMinutes, businessMinutesBetween } from "../../src/services/sla/business-hours.js";
import { createSlaContext, evaluateSla } from "../../src/services/sla/sla-service.js";

const TZ = "Asia/Kolkata";
const NO_HOLIDAYS = new Set<string>();

function ist(date: string, time: string): Date {
  const zoned = DateTime.fromISO(`${date}T${time}`, { zone: TZ });
  if (!zoned.isValid) {
    throw new Error(`Invalid IST datetime ${date} ${time}`);
  }
  return zoned.toJSDate();
}

function istStamp(date: Date): string {
  return DateTime.fromJSDate(date, { zone: TZ }).toFormat("yyyy-MM-dd HH:mm");
}

function slaContext(now: Date, holidayDates: ReadonlySet<string> = NO_HOLIDAYS) {
  return createSlaContext({
    now,
    holidays: [...holidayDates].map((key) => ({ date: new Date(`${key}T00:00:00.000Z`) })),
    timezone: TZ,
  });
}

describe("business hours", () => {
  it("adds time on a normal weekday", () => {
    const due = addBusinessMinutes(ist("2026-08-24", "09:00:00"), 4 * 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-24 13:00");
  });

  it("starts counting at 09:00 when created before business hours", () => {
    const due = addBusinessMinutes(ist("2026-08-24", "07:00:00"), 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-24 10:00");
  });

  it("starts counting the next morning when created after business hours", () => {
    const due = addBusinessMinutes(ist("2026-08-24", "20:00:00"), 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-25 10:00");
  });

  it("skips the weekend", () => {
    const due = addBusinessMinutes(ist("2026-08-22", "11:00:00"), 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-24 10:00");
  });

  it("uses only one minute on Friday evening before the weekend", () => {
    const start = ist("2026-08-21", "17:59:00");
    const due = addBusinessMinutes(start, 1, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-21 18:00");
    expect(businessMinutesBetween(start, due, NO_HOLIDAYS, TZ)).toBe(1);
  });

  it("carries HIGH first-response hours from Friday 17:00 to Monday 12:00", () => {
    const due = addBusinessMinutes(ist("2026-08-21", "17:00:00"), 4 * 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-24 12:00");
  });

  it("skips a public holiday", () => {
    const holidays = new Set(["2026-08-24"]);
    const due = addBusinessMinutes(ist("2026-08-21", "17:00:00"), 4 * 60, holidays, TZ);
    expect(istStamp(due)).toBe("2026-08-25 12:00");
  });

  it("skips a weekend plus a Monday holiday", () => {
    const holidays = new Set(["2026-08-24"]);
    const due = addBusinessMinutes(ist("2026-08-22", "10:00:00"), 60, holidays, TZ);
    expect(istStamp(due)).toBe("2026-08-25 10:00");
  });

  it("crosses multiple business days", () => {
    const due = addBusinessMinutes(ist("2026-08-24", "09:00:00"), 24 * 60, NO_HOLIDAYS, TZ);
    expect(istStamp(due)).toBe("2026-08-26 15:00");
  });
});

describe("evaluateSla", () => {
  it("computes first-response and resolution due times for HIGH", () => {
    const sla = evaluateSla(
      {
        priority: "HIGH",
        createdAt: ist("2026-08-21", "17:00:00"),
        firstResponseAt: null,
        resolvedAt: null,
      },
      slaContext(ist("2026-08-21", "17:00:00")),
    );

    expect(istStamp(sla.firstResponseDueAt)).toBe("2026-08-24 12:00");
    expect(istStamp(sla.resolutionDueAt)).toBe("2026-08-26 14:00");
    expect(sla.firstResponseState).toBe("ON_TRACK");
    expect(sla.resolutionState).toBe("ON_TRACK");
    expect(sla.firstResponseRemainingMinutes).toBe(4 * 60);
    expect(sla.resolutionRemainingMinutes).toBe(24 * 60);
  });

  it("marks first response AT_RISK after more than 75% of the budget is consumed", () => {
    const sla = evaluateSla(
      {
        priority: "URGENT",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: null,
        resolvedAt: null,
      },
      slaContext(ist("2026-08-24", "09:46:00")),
    );

    expect(sla.firstResponseState).toBe("AT_RISK");
    expect(sla.firstResponseRemainingMinutes).toBe(14);
  });

  it("stays ON_TRACK at exactly 75% consumed", () => {
    const sla = evaluateSla(
      {
        priority: "URGENT",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: null,
        resolvedAt: null,
      },
      slaContext(ist("2026-08-24", "09:45:00")),
    );

    expect(sla.firstResponseState).toBe("ON_TRACK");
    expect(sla.firstResponseRemainingMinutes).toBe(15);
  });

  it("marks first response BREACHED after the due time", () => {
    const sla = evaluateSla(
      {
        priority: "URGENT",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: null,
        resolvedAt: null,
      },
      slaContext(ist("2026-08-24", "10:01:00")),
    );

    expect(sla.firstResponseState).toBe("BREACHED");
    expect(sla.firstResponseRemainingMinutes).toBe(0);
  });

  it("freezes first-response SLA as completed and never becomes BREACHED later", () => {
    const sla = evaluateSla(
      {
        priority: "HIGH",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: ist("2026-08-24", "11:00:00"),
        resolvedAt: null,
      },
      slaContext(ist("2026-08-28", "12:00:00")),
    );

    expect(sla.firstResponseState).toBe("ON_TRACK");
    expect(sla.firstResponseRemainingMinutes).toBe(0);
    expect(sla.resolutionState).toBe("BREACHED");
  });

  it("freezes a late first response as BREACHED", () => {
    const sla = evaluateSla(
      {
        priority: "URGENT",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: ist("2026-08-24", "11:00:00"),
        resolvedAt: null,
      },
      slaContext(ist("2026-08-24", "16:00:00")),
    );

    expect(sla.firstResponseState).toBe("BREACHED");
    expect(sla.firstResponseRemainingMinutes).toBe(0);
  });

  it("freezes resolution SLA when resolvedAt is set", () => {
    const sla = evaluateSla(
      {
        priority: "HIGH",
        createdAt: ist("2026-08-24", "09:00:00"),
        firstResponseAt: ist("2026-08-24", "10:00:00"),
        resolvedAt: ist("2026-08-24", "15:00:00"),
      },
      slaContext(ist("2026-08-31", "09:00:00")),
    );

    expect(sla.resolutionState).toBe("ON_TRACK");
    expect(sla.resolutionRemainingMinutes).toBe(0);
  });
});
