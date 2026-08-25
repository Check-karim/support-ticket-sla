import { createServer } from "node:http";
import { createSchema, createYoga } from "graphql-yoga";
import { env } from "./config/env.js";
import { prisma } from "./db/client.js";
import { authenticateRequest } from "./graphql/authenticate.js";
import type { GraphQLContext } from "./graphql/context.js";
import { toGraphQLError } from "./graphql/errors.js";
import { loadTypeDefs } from "./graphql/load-type-defs.js";
import { resolvers } from "./graphql/resolver/index.js";

const schema = createSchema({
  typeDefs: loadTypeDefs(),
  resolvers,
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: "/graphql",
  context: async ({ request }): Promise<GraphQLContext> => {
    try {
      return {
        prisma,
        user: await authenticateRequest(request, prisma),
      };
    } catch (error: unknown) {
      throw toGraphQLError(error);
    }
  },
});

const server = createServer(yoga);

server.listen(env.port, () => {
  console.log(`GraphQL Yoga ready at http://localhost:${env.port}/graphql`);
});
