import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../src/errors.js";
import { assertStatusTransition, isReopen } from "../../src/services/ticket/status-transitions.js";

describe("status transitions", () => {
  it("allows OPEN to IN_PROGRESS and RESOLVED", () => {
    expect(() => assertStatusTransition("OPEN", "IN_PROGRESS")).not.toThrow();
    expect(() => assertStatusTransition("OPEN", "RESOLVED")).not.toThrow();
  });

  it("allows IN_PROGRESS to RESOLVED and OPEN", () => {
    expect(() => assertStatusTransition("IN_PROGRESS", "RESOLVED")).not.toThrow();
    expect(() => assertStatusTransition("IN_PROGRESS", "OPEN")).not.toThrow();
  });

  it("allows RESOLVED to CLOSED and OPEN", () => {
    expect(() => assertStatusTransition("RESOLVED", "CLOSED")).not.toThrow();
    expect(() => assertStatusTransition("RESOLVED", "OPEN")).not.toThrow();
  });

  it("allows CLOSED to OPEN only", () => {
    expect(() => assertStatusTransition("CLOSED", "OPEN")).not.toThrow();
  });

  it("rejects CLOSED to IN_PROGRESS", () => {
    expect(() => assertStatusTransition("CLOSED", "IN_PROGRESS")).toThrow(AppError);
    try {
      assertStatusTransition("CLOSED", "IN_PROGRESS");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
    }
  });

  it("rejects OPEN to CLOSED", () => {
    expect(() => assertStatusTransition("OPEN", "CLOSED")).toThrow(AppError);
  });

  it("rejects staying in the same status", () => {
    expect(() => assertStatusTransition("OPEN", "OPEN")).toThrow(AppError);
  });

  it("detects reopen transitions", () => {
    expect(isReopen("RESOLVED", "OPEN")).toBe(true);
    expect(isReopen("CLOSED", "OPEN")).toBe(true);
    expect(isReopen("OPEN", "IN_PROGRESS")).toBe(false);
  });
});
