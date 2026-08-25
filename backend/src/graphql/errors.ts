import { GraphQLError } from "graphql";
import { AppError } from "../errors.js";

export function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof AppError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code },
    });
  }

  if (error instanceof GraphQLError) {
    return error;
  }

  return new GraphQLError("Internal server error", {
    extensions: { code: "INTERNAL_SERVER_ERROR" },
  });
}

export async function resolveOrThrow<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    throw toGraphQLError(error);
  }
}
