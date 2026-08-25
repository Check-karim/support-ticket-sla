import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "../services/auth/permissions.js";

export type GraphQLContext = {
  prisma: PrismaClient;
  user: AuthenticatedUser | null;
};
