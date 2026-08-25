import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../src/errors.js";
import { requireAgent, requireUser } from "../../src/services/auth/permissions.js";
import { requireNonEmpty } from "../../src/validation/input.js";

describe("input validation", () => {
  it("trims non-empty values", () => {
    expect(requireNonEmpty("  title  ", "title")).toBe("title");
  });

  it("rejects empty title and description", () => {
    expect(() => requireNonEmpty("   ", "title")).toThrow(AppError);
    expect(() => requireNonEmpty("", "description")).toThrow(AppError);
    try {
      requireNonEmpty("", "title");
    } catch (error: unknown) {
      expect((error as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });
});

describe("authorization", () => {
  it("rejects unauthenticated access", () => {
    try {
      requireUser(null);
      throw new Error("expected UNAUTHORIZED");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.UNAUTHORIZED);
    }
  });

  it("returns the authenticated user", () => {
    const user = requireUser({ id: "user-1", role: "REPORTER" });
    expect(user.id).toBe("user-1");
  });

  it("forbids reporters from agent actions", () => {
    try {
      requireAgent({ id: "user-1", role: "REPORTER" });
      throw new Error("expected FORBIDDEN");
    } catch (error: unknown) {
      expect((error as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it("allows agents to perform agent actions", () => {
    expect(() => requireAgent({ id: "agent-1", role: "AGENT" })).not.toThrow();
  });
});
