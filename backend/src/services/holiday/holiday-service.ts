import type { PrismaClient } from "@prisma/client";

export async function listHolidays(prisma: PrismaClient) {
  return prisma.holiday.findMany({
    orderBy: { date: "asc" },
  });
}
