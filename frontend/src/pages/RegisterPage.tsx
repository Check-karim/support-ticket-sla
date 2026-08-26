import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.js";
import { ErrorBanner } from "../ErrorBanner.js";

export function RegisterPage() {
  const { token, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Create reporter account</h1>
      <p className="muted">Self-service registration is for reporters only. Agents are provisioned by seed.</p>
      <ErrorBanner error={error} />
      <form onSubmit={(event) => void onSubmit(event)}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Register"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
