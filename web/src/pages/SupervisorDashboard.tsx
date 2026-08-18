import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export default function SupervisorDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiGet("/dashboard/supervisor").then(setData);
  }, []);

  if (!data) return <p>Loading…</p>;

  return (
    <div>
      <h1>Supervisor Dashboard</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Your team's activity this week.
      </p>

      <div className="card" style={{ display: "inline-block", marginBottom: 8 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: "var(--leaves-green-700)" }}>{data.visitsThisWeek}</div>
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: 4 }}>Visits this week</div>
      </div>

      <h2>Open Tickets</h2>
      <table>
        <thead>
          <tr><th>Client</th><th>Type</th><th>Status</th></tr>
        </thead>
        <tbody>
          {data.openTickets?.map((t: any) => (
            <tr key={t.id}>
              <td>{t.client?.name}</td>
              <td>
                {t.type === "emergency"
                  ? <span className="badge badge-emergency">Emergency</span>
                  : <span className="badge badge-open">Standard</span>}
              </td>
              <td><span className={`badge badge-${t.status}`}>{t.status.replace("_", " ")}</span></td>
            </tr>
          ))}
          {data.openTickets?.length === 0 && (
            <tr><td colSpan={3} style={{ color: "var(--color-text-muted)" }}>No open tickets.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
