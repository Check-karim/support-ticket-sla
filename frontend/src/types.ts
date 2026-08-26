export type UserRole = "REPORTER" | "AGENT";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";
export type TicketSort =
  | "CREATED_AT_DESC"
  | "CREATED_AT_ASC"
  | "PRIORITY_DESC"
  | "PRIORITY_ASC"
  | "SLA_REMAINING_ASC"
  | "SLA_REMAINING_DESC";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type SLAInfo = {
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseState: SLAState;
  resolutionState: SLAState;
  firstResponseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
};

export type Comment = {
  id: string;
  content: string;
  author: User;
  createdAt: string;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  reporter: User;
  assignee: User | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  sla: SLAInfo;
  comments?: Comment[];
};

export type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type TicketConnection = {
  nodes: Ticket[];
  pageInfo: PageInfo;
};

export type TicketDashboard = {
  openTickets: number;
  inProgressTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
};

export type AuthPayload = {
  token: string;
  user: User;
};
