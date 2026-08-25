import type { PrismaClient, UserRole } from "@prisma/client";
import { publicUserSelect } from "../ticket/ticket-service.js";

export async function listUsers(
  prisma: PrismaClient,
  role: UserRole | null | undefined,
) {
  return prisma.user.findMany({
    ...(role != null ? { where: { role } } : {}),
    select: publicUserSelect,
    orderBy: { name: "asc" },
  });
}
