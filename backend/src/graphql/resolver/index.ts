import { mutationResolvers } from "./mutation.js";
import { queryResolvers } from "./query.js";
import { commentResolvers, holidayResolvers, ticketResolvers, userResolvers } from "./types.js";

export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Ticket: ticketResolvers,
  User: userResolvers,
  Comment: commentResolvers,
  Holiday: holidayResolvers,
};
