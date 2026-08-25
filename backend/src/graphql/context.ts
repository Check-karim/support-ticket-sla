import type { PrismaClient } from "@prisma/client";
import type { AuthenticatedUser } from "../services/auth/permissions.js";
import type { SlaEvaluationContext } from "../services/sla/sla-service.js";

export type GraphQLContext = {
  prisma: PrismaClient;
  user: AuthenticatedUser | null;
  sla: SlaEvaluationContext;
};
