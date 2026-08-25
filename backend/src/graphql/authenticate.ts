import type { PrismaClient } from "@prisma/client";
import { AppError, ErrorCode } from "../errors.js";
import type { AuthenticatedUser } from "../services/auth/permissions.js";
import { verifyAccessToken } from "../services/auth/token.js";

export async function authenticateRequest(
  request: Request,
  prisma: PrismaClient,
): Promise<AuthenticatedUser | null> {
  const header = request.headers.get("authorization");
  if (header === null || header.trim() === "") {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const token = match?.[1];
  if (token === undefined) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid authorization header.");
  }

  const { userId } = await verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (user === null) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired token.");
  }

  return user;
}
