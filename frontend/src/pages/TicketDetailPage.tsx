import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client.js";
import {
  addCommentRequest,
  assignTicketRequest,
  changeStatusRequest,
  fetchAgents,
  fetchTicket,
  resolveTicketRequest,
} from "../api/operations.js";
import { useAuth } from "../auth.js";
import { ErrorBanner } from "../ErrorBanner.js";
import { formatMinutes, formatTimestamp, slaLabel } from "../slaDisplay.js";
import type { Ticket, TicketStatus, User } from "../types.js";

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function TicketDetailPage() {
  const { id } = useParams();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [comment, setComment] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketStatus>("IN_PROGRESS");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    if (id === undefined) {
      return;
    }
    void (async () => {
      try {
        const [loaded, agentList] = await Promise.all([
          fetchTicket(token, id),
          fetchAgents(token),
        ]);
        setTicket(loaded);
        setAgents(agentList);
        setAssigneeId(loaded.assignee?.id ?? agentList[0]?.id ?? "");
        setNextStatus(loaded.status);
      } catch (caught: unknown) {
        if (caught instanceof ApiError && caught.code === "UNAUTHORIZED") {
          logout();
          navigate("/login");
          return;
        }
        setError(caught);
      }
    })();
  }, [token, id, navigate, logout]);

  if (!token || !user) {
    return null;
  }
  const accessToken = token;

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  async function onComment(event: FormEvent) {
    event.preventDefault();
    if (id === undefined) {
      return;
    }
    await run(async () => {
      await addCommentRequest(accessToken, id, comment);
      setComment("");
      setTicket(await fetchTicket(accessToken, id));
    });
  }

  const isAgent = user.role === "AGENT";

  return (
    <main className="page">
      <p>
        <Link to="/">← Tickets</Link>
      </p>
      <ErrorBanner error={error} />
      {!ticket ? (
        <p className="muted">Loading ticket…</p>
      ) : (
        <>
          <header className="topbar">
            <div>
              <h1>{ticket.title}</h1>
              <p className="muted">
                {ticket.id} · {ticket.reporter.name} · created {formatTimestamp(ticket.createdAt)}
              </p>
            </div>
            <div className="actions">
              <span className={`pill priority-${ticket.priority}`}>{ticket.priority}</span>
              <span className="pill">{ticket.status}</span>
            </div>
          </header>

          <p className="body">{ticket.description}</p>

          <section className="sla-grid">
            <article>
              <h2>First response</h2>
              <p className={`pill sla-${ticket.sla.firstResponseState}`}>
                {slaLabel({
                  state: ticket.sla.firstResponseState,
                  remainingMinutes: ticket.sla.firstResponseRemainingMinutes,
                })}
              </p>
              <p>Due {formatTimestamp(ticket.sla.firstResponseDueAt)}</p>
              <p>{formatMinutes(ticket.sla.firstResponseRemainingMinutes)} remaining (from API)</p>
            </article>
            <article>
              <h2>Resolution</h2>
              <p className={`pill sla-${ticket.sla.resolutionState}`}>
                {slaLabel({
                  state: ticket.sla.resolutionState,
                  remainingMinutes: ticket.sla.resolutionRemainingMinutes,
                })}
              </p>
              <p>Due {formatTimestamp(ticket.sla.resolutionDueAt)}</p>
              <p>{formatMinutes(ticket.sla.resolutionRemainingMinutes)} remaining (from API)</p>
            </article>
          </section>

          <p>
            Assignee: <strong>{ticket.assignee?.name ?? "Unassigned"}</strong>
            {ticket.firstResponseAt
              ? ` · First response ${formatTimestamp(ticket.firstResponseAt)}`
              : ""}
            {ticket.resolvedAt ? ` · Resolved ${formatTimestamp(ticket.resolvedAt)}` : ""}
          </p>

          {isAgent ? (
            <section className="agent-panel">
              <h2>Agent actions</h2>
              <div className="filters">
                <label>
                  Assign
                  <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending || assigneeId === ""}
                  onClick={() =>
                    void run(async () => {
                      setTicket(await assignTicketRequest(accessToken, ticket.id, assigneeId));
                    })
                  }
                >
                  Assign
                </button>
                <label>
                  Status
                  <select
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as TicketStatus)}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      setTicket(await changeStatusRequest(accessToken, ticket.id, nextStatus));
                    })
                  }
                >
                  Update status
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void run(async () => {
                      setTicket(await resolveTicketRequest(accessToken, ticket.id));
                    })
                  }
                >
                  Resolve
                </button>
              </div>
            </section>
          ) : null}

          <section>
            <h2>Comments</h2>
            <ul className="comments">
              {(ticket.comments ?? []).map((item) => (
                <li key={item.id}>
                  <strong>{item.author.name}</strong>
                  <span className="muted"> {formatTimestamp(item.createdAt)}</span>
                  <p>{item.content}</p>
                </li>
              ))}
            </ul>
            <form className="stack" onSubmit={(event) => void onComment(event)}>
              <label>
                Add comment
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  required
                />
              </label>
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Post comment"}
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
