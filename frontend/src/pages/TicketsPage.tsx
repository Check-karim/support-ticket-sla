import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { fetchAgents, fetchDashboard, fetchTickets } from "../api/operations.js";
import { useAuth } from "../auth.js";
import { ErrorBanner } from "../ErrorBanner.js";
import { formatTimestamp, slaLabel, slaSummary } from "../slaDisplay.js";
import type {
  Priority,
  SLAState,
  Ticket,
  TicketDashboard,
  TicketSort,
  TicketStatus,
  User,
} from "../types.js";

export function TicketsPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dashboard, setDashboard] = useState<TicketDashboard | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [assigneeId, setAssigneeId] = useState("");
  const [slaState, setSlaState] = useState<SLAState | "">("");
  const [sort, setSort] = useState<TicketSort>("CREATED_AT_DESC");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (append: boolean, nextCursor: string | null) => {
      if (!token) {
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const [list, stats, agentList] = await Promise.all([
          fetchTickets(token, {
            ...(status !== "" ? { status } : {}),
            ...(priority !== "" ? { priority } : {}),
            ...(assigneeId !== "" ? { assigneeId } : {}),
            ...(slaState !== "" ? { slaState } : {}),
            ...(nextCursor ? { cursor: nextCursor } : {}),
            sort,
          }),
          fetchDashboard(token),
          fetchAgents(token),
        ]);
        setTickets((current) => (append ? [...current, ...list.nodes] : list.nodes));
        setHasNextPage(list.pageInfo.hasNextPage);
        setCursor(list.pageInfo.endCursor);
        setDashboard(stats);
        setAgents(agentList);
      } catch (caught: unknown) {
        if (caught instanceof ApiError && caught.code === "UNAUTHORIZED") {
          logout();
          navigate("/login");
          return;
        }
        setError(caught);
      } finally {
        setLoading(false);
      }
    },
    [token, status, priority, assigneeId, slaState, sort, logout, navigate],
  );

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    void load(false, null);
  }, [token, load, navigate]);

  if (!token || !user) {
    return null;
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Support tickets</h1>
          <p className="muted">
            {user.name} · {user.role} · timestamps in your local timezone
          </p>
        </div>
        <div className="actions">
          <Link className="button" to="/tickets/new">
            New ticket
          </Link>
          <button type="button" className="secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {dashboard ? (
        <section className="stats">
          <article>
            <span>Open</span>
            <strong>{dashboard.openTickets}</strong>
          </article>
          <article>
            <span>In progress</span>
            <strong>{dashboard.inProgressTickets}</strong>
          </article>
          <article>
            <span>At risk</span>
            <strong>{dashboard.atRiskTickets}</strong>
          </article>
          <article>
            <span>Breached</span>
            <strong>{dashboard.breachedTickets}</strong>
          </article>
        </section>
      ) : null}

      <ErrorBanner error={error} />

      <section className="filters">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus | "")}>
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority | "")}>
            <option value="">All</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label>
          Assignee
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">All</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          SLA
          <select value={slaState} onChange={(event) => setSlaState(event.target.value as SLAState | "")}>
            <option value="">All</option>
            <option value="ON_TRACK">ON_TRACK</option>
            <option value="AT_RISK">AT_RISK</option>
            <option value="BREACHED">BREACHED</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as TicketSort)}>
            <option value="CREATED_AT_DESC">Newest</option>
            <option value="CREATED_AT_ASC">Oldest</option>
            <option value="PRIORITY_DESC">Priority high-low</option>
            <option value="PRIORITY_ASC">Priority low-high</option>
            <option value="SLA_REMAINING_ASC">Least SLA time</option>
            <option value="SLA_REMAINING_DESC">Most SLA time</option>
          </select>
        </label>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>SLA</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const summary = slaSummary(ticket.sla);
              return (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                    <div className="muted small">{ticket.id.slice(0, 8)}</div>
                  </td>
                  <td>
                    <span className={`pill priority-${ticket.priority}`}>{ticket.priority}</span>
                  </td>
                  <td>{ticket.status}</td>
                  <td>{ticket.assignee?.name ?? "Unassigned"}</td>
                  <td>
                    <span className={`pill sla-${summary.state}`}>{slaLabel(summary)}</span>
                  </td>
                  <td>{formatTimestamp(ticket.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tickets.length === 0 && !loading ? <p className="muted">No tickets match these filters.</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {hasNextPage ? (
        <button type="button" className="secondary" onClick={() => void load(true, cursor)}>
          Load more
        </button>
      ) : null}
    </main>
  );
}
