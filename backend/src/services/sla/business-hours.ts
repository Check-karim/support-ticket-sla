import { DateTime } from "luxon";

export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 18;
export const MINUTES_PER_BUSINESS_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

export function holidayKeyFromDateColumn(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function holidayDatesFromRows(holidays: readonly { date: Date }[]): ReadonlySet<string> {
  return new Set(holidays.map((holiday) => holidayKeyFromDateColumn(holiday.date)));
}

export function toZoned(date: Date, timezone: string): DateTime {
  const zoned = DateTime.fromJSDate(date, { zone: timezone });
  if (!zoned.isValid) {
    throw new Error(`Invalid datetime or timezone: ${timezone}`);
  }
  return zoned;
}

function startOfBusinessDay(dt: DateTime): DateTime {
  return dt.set({
    hour: BUSINESS_START_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

function endOfBusinessDay(dt: DateTime): DateTime {
  return dt.set({
    hour: BUSINESS_END_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

function isHoliday(dt: DateTime, holidays: ReadonlySet<string>): boolean {
  return holidays.has(dt.toFormat("yyyy-MM-dd"));
}

export function isBusinessDay(dt: DateTime, holidays: ReadonlySet<string>): boolean {
  return dt.weekday >= 1 && dt.weekday <= 5 && !isHoliday(dt, holidays);
}

export function isInBusinessHours(dt: DateTime, holidays: ReadonlySet<string>): boolean {
  if (!isBusinessDay(dt, holidays)) {
    return false;
  }
  return dt >= startOfBusinessDay(dt) && dt < endOfBusinessDay(dt);
}

export function nextBusinessStart(
  dt: DateTime,
  holidays: ReadonlySet<string>,
): DateTime {
  if (isInBusinessHours(dt, holidays)) {
    return dt;
  }

  if (isBusinessDay(dt, holidays) && dt < startOfBusinessDay(dt)) {
    return startOfBusinessDay(dt);
  }

  let cursor = startOfBusinessDay(dt).plus({ days: 1 });
  let guard = 0;
  while (!isBusinessDay(cursor, holidays)) {
    cursor = cursor.plus({ days: 1 });
    guard += 1;
    if (guard > 3660) {
      throw new Error("Could not find a business day within 10 years.");
    }
  }
  return startOfBusinessDay(cursor);
}

export function addBusinessMinutes(
  start: Date,
  minutes: number,
  holidays: ReadonlySet<string>,
  timezone: string,
): Date {
  if (minutes < 0) {
    throw new Error("Business minutes must not be negative.");
  }

  let remainingMs = minutes * 60_000;
  let cursor = nextBusinessStart(toZoned(start, timezone), holidays);

  if (remainingMs === 0) {
    return cursor.toUTC().toJSDate();
  }

  let guard = 0;
  while (remainingMs > 0) {
    const dayEnd = endOfBusinessDay(cursor);
    const availableMs = dayEnd.toMillis() - cursor.toMillis();
    if (remainingMs <= availableMs) {
      return cursor.plus({ milliseconds: remainingMs }).toUTC().toJSDate();
    }
    remainingMs -= availableMs;
    cursor = nextBusinessStart(dayEnd.plus({ milliseconds: 1 }), holidays);
    guard += 1;
    if (guard > 3660) {
      throw new Error("Business-minute addition exceeded 10 years.");
    }
  }

  return cursor.toUTC().toJSDate();
}

export function businessMinutesBetween(
  start: Date,
  end: Date,
  holidays: ReadonlySet<string>,
  timezone: string,
): number {
  if (end.getTime() <= start.getTime()) {
    return 0;
  }

  let cursor = nextBusinessStart(toZoned(start, timezone), holidays);
  const endZoned = toZoned(end, timezone);
  if (cursor >= endZoned) {
    return 0;
  }

  let totalMs = 0;
  let guard = 0;
  while (cursor < endZoned) {
    const dayEnd = endOfBusinessDay(cursor);
    const windowEnd = endZoned < dayEnd ? endZoned : dayEnd;
    if (windowEnd > cursor) {
      totalMs += windowEnd.toMillis() - cursor.toMillis();
    }
    cursor = nextBusinessStart(dayEnd.plus({ milliseconds: 1 }), holidays);
    guard += 1;
    if (guard > 3660) {
      throw new Error("Business-minute difference exceeded 10 years.");
    }
  }

  return Math.floor(totalMs / 60_000);
}
