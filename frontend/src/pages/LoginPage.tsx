import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.js";
import { ErrorBanner } from "../ErrorBanner.js";

export function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("agent@example.com");
  const [password, setPassword] = useState("password123");
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
      await login(email, password);
      navigate("/");
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>Support tickets</h1>
      <p className="muted">Sign in to view SLA-backed tickets. Seed agent: agent@example.com / password123</p>
      <ErrorBanner error={error} />
      <form onSubmit={(event) => void onSubmit(event)}>
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
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p>
        New reporter? <Link to="/register">Create an account</Link>
      </p>
    </main>
  );
}
