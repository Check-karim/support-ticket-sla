import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTicketRequest } from "../api/operations.js";
import { useAuth } from "../auth.js";
import { ErrorBanner } from "../ErrorBanner.js";
import type { Priority } from "../types.js";

export function NewTicketPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  if (!token) {
    return null;
  }
  const accessToken = token;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const ticket = await createTicketRequest(accessToken, { title, description, priority });
      navigate(`/tickets/${ticket.id}`);
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page">
      <p>
        <Link to="/">← Tickets</Link>
      </p>
      <h1>New ticket</h1>
      <ErrorBanner error={error} />
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            required
          />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create ticket"}
        </button>
      </form>
    </main>
  );
}
