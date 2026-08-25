import { commentResolvers, holidayResolvers, ticketResolvers, userResolvers } from "./types.js";
import { queryResolvers } from "./query.js";

export const resolvers = {
  Query: queryResolvers,
  Ticket: ticketResolvers,
  User: userResolvers,
  Comment: commentResolvers,
  Holiday: holidayResolvers,
};
