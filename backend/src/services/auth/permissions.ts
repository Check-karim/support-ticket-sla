import type { UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export function requireUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (user === null) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required.");
  }
  return user;
}

export function requireAgent(user: AuthenticatedUser): void {
  if (user.role !== "AGENT") {
    throw new AppError(ErrorCode.FORBIDDEN, "Only agents can perform this action.");
  }
}
