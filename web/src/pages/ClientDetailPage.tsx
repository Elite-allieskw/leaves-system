import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../api/client";

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    if (id) apiGet(`/clients/${id}`).then(setClient);
  }, [id]);

  if (!client) return <p>Loading…</p>;

  return (
    <div>
      <h1>{client.name}</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>{client.address}</p>

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <h2 style={{ marginTop: 0 }}>Garden Profile</h2>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: "0.9rem" }}>
            <dt style={{ color: "var(--color-text-muted)" }}>Size</dt><dd style={{ margin: 0 }}>{client.gardenProfile?.size ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Shape</dt><dd style={{ margin: 0 }}>{client.gardenProfile?.shape ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Theme</dt><dd style={{ margin: 0 }}>{client.gardenProfile?.theme ?? "—"}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Valuable plants</dt>
            <dd style={{ margin: 0 }}>{client.gardenProfile?.valuablePlants?.join(", ") || "—"}</dd>
          </dl>
        </div>
      </div>

      <h2>Visit History</h2>
      <table>
        <thead><tr><th>Date</th><th>Status</th><th>Notes</th><th>Photo</th><th>Video</th></tr></thead>
        <tbody>
          {client.visits?.map((v: any) => (
            <tr key={v.id}>
              <td>{new Date(v.date).toLocaleDateString()}</td>
              <td>
                {v.status === "needs_followup"
                  ? <span className="badge badge-open">Needs follow-up</span>
                  : <span className="badge badge-resolved">Completed</span>}
              </td>
              <td>{v.notes || "—"}</td>
              <td>{v.referencePhotoUrl ? <a href={v.referencePhotoUrl} target="_blank" rel="noreferrer">View</a> : "—"}</td>
              <td>{v.videoUrl ? <a href={v.videoUrl} target="_blank" rel="noreferrer">View</a> : "—"}</td>
            </tr>
          ))}
          {(!client.visits || client.visits.length === 0) && (
            <tr><td colSpan={5} style={{ color: "var(--color-text-muted)" }}>No visits logged yet.</td></tr>
          )}
        </tbody>
      </table>

      <h2>Tickets</h2>
      <table>
        <thead><tr><th>Type</th><th>Status</th><th>Raised</th></tr></thead>
        <tbody>
          {client.tickets?.map((t: any) => (
            <tr key={t.id}>
              <td>{t.type === "emergency" ? <span className="badge badge-emergency">Emergency</span> : "Standard"}</td>
              <td><span className={`badge badge-${t.status}`}>{t.status.replace("_", " ")}</span></td>
              <td>{new Date(t.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {(!client.tickets || client.tickets.length === 0) && (
            <tr><td colSpan={3} style={{ color: "var(--color-text-muted)" }}>No tickets.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
