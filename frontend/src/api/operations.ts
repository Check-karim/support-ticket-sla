import { graphqlRequest } from "./client.js";
import type {
  AuthPayload,
  Priority,
  SLAState,
  Ticket,
  TicketConnection,
  TicketDashboard,
  TicketSort,
  TicketStatus,
  User,
} from "../types.js";

const TICKET_FIELDS = `
  id
  title
  description
  priority
  status
  createdAt
  firstResponseAt
  resolvedAt
  reporter { id name email role createdAt }
  assignee { id name email role createdAt }
  sla {
    firstResponseDueAt
    resolutionDueAt
    firstResponseState
    resolutionState
    firstResponseRemainingMinutes
    resolutionRemainingMinutes
  }
`;

export async function loginRequest(email: string, password: string): Promise<AuthPayload> {
  const data = await graphqlRequest<{ login: AuthPayload }>(
    `mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) { token user { id name email role createdAt } }
    }`,
    { email, password },
    null,
  );
  return data.login;
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
): Promise<AuthPayload> {
  const data = await graphqlRequest<{ register: AuthPayload }>(
    `mutation Register($name: String!, $email: String!, $password: String!) {
      register(name: $name, email: $email, password: $password, role: REPORTER) {
        token
        user { id name email role createdAt }
      }
    }`,
    { name, email, password },
    null,
  );
  return data.register;
}

export async function fetchTickets(
  token: string,
  filters: {
    status?: TicketStatus;
    priority?: Priority;
    assigneeId?: string;
    slaState?: SLAState;
    cursor?: string;
    sort?: TicketSort;
  },
): Promise<TicketConnection> {
  const data = await graphqlRequest<{ tickets: TicketConnection }>(
    `query Tickets($status: TicketStatus, $priority: Priority, $assigneeId: ID, $slaState: SLAState, $cursor: String, $sort: TicketSort) {
      tickets(status: $status, priority: $priority, assigneeId: $assigneeId, slaState: $slaState, take: 20, cursor: $cursor, sort: $sort) {
        nodes { ${TICKET_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { ...filters },
    token,
  );
  return data.tickets;
}

export async function fetchTicket(token: string, id: string): Promise<Ticket> {
  const data = await graphqlRequest<{ ticket: Ticket | null }>(
    `query Ticket($id: ID!) {
      ticket(id: $id) {
        ${TICKET_FIELDS}
        comments { id content createdAt author { id name email role createdAt } }
      }
    }`,
    { id },
    token,
  );
  if (data.ticket === null) {
    throw new Error("Ticket not found");
  }
  return data.ticket;
}

export async function fetchDashboard(token: string): Promise<TicketDashboard> {
  const data = await graphqlRequest<{ dashboard: TicketDashboard }>(
    `query Dashboard { dashboard { openTickets inProgressTickets atRiskTickets breachedTickets } }`,
    undefined,
    token,
  );
  return data.dashboard;
}

export async function fetchAgents(token: string): Promise<User[]> {
  const data = await graphqlRequest<{ users: User[] }>(
    `query Agents { users(role: AGENT) { id name email role createdAt } }`,
    undefined,
    token,
  );
  return data.users;
}

export async function createTicketRequest(
  token: string,
  input: { title: string; description: string; priority: Priority },
): Promise<Ticket> {
  const data = await graphqlRequest<{ createTicket: Ticket }>(
    `mutation CreateTicket($title: String!, $description: String!, $priority: Priority!) {
      createTicket(title: $title, description: $description, priority: $priority) { ${TICKET_FIELDS} }
    }`,
    input,
    token,
  );
  return data.createTicket;
}

export async function addCommentRequest(
  token: string,
  ticketId: string,
  content: string,
): Promise<void> {
  await graphqlRequest(
    `mutation AddComment($ticketId: ID!, $content: String!) {
      addComment(ticketId: $ticketId, content: $content) { id }
    }`,
    { ticketId, content },
    token,
  );
}

export async function assignTicketRequest(
  token: string,
  ticketId: string,
  assigneeId: string,
): Promise<Ticket> {
  const data = await graphqlRequest<{ assignTicket: Ticket }>(
    `mutation AssignTicket($ticketId: ID!, $assigneeId: ID!) {
      assignTicket(ticketId: $ticketId, assigneeId: $assigneeId) { ${TICKET_FIELDS} }
    }`,
    { ticketId, assigneeId },
    token,
  );
  return data.assignTicket;
}

export async function changeStatusRequest(
  token: string,
  ticketId: string,
  status: TicketStatus,
): Promise<Ticket> {
  const data = await graphqlRequest<{ changeTicketStatus: Ticket }>(
    `mutation ChangeStatus($ticketId: ID!, $status: TicketStatus!) {
      changeTicketStatus(ticketId: $ticketId, status: $status) { ${TICKET_FIELDS} }
    }`,
    { ticketId, status },
    token,
  );
  return data.changeTicketStatus;
}

export async function resolveTicketRequest(token: string, ticketId: string): Promise<Ticket> {
  const data = await graphqlRequest<{ resolveTicket: Ticket }>(
    `mutation ResolveTicket($ticketId: ID!) {
      resolveTicket(ticketId: $ticketId) { ${TICKET_FIELDS} }
    }`,
    { ticketId },
    token,
  );
  return data.resolveTicket;
}
