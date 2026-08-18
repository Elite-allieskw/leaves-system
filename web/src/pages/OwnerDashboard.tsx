import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export default function OwnerDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiGet("/dashboard/owner").then(setData);
  }, []);

  if (!data) return <p>Loading…</p>;

  return (
    <div>
      <h1>Owner Dashboard</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        The full picture — all clients, all teams, this week at a glance.
      </p>
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <Stat label="Total Clients" value={data.clientCount} />
        <Stat label="Open Tickets" value={data.openTicketCount} />
        <Stat label="Visits This Week" value={data.visitsThisWeek} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ minWidth: 160 }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: "var(--leaves-green-700)" }}>{value}</div>
      <div style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: 4 }}>{label}</div>
    </div>
  );
}
