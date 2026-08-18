import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { defaultRouteForRole } from "../api/auth";
import { LeavesLogo } from "../components/LeavesLogo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const from = (location.state as { from?: string })?.from;
      navigate(from ?? defaultRouteForRole(user.role), { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <form onSubmit={submit} className="card" style={{ width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <LeavesLogo size={48} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: "var(--leaves-green-900)" }}>Leaves</div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Maintenance System</div>
          </div>
        </div>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p style={{ color: "var(--leaves-status-open)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </button>

        <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
          New accounts are created by the owner — contact them for access.
        </p>
      </form>
    </div>
  );
}
