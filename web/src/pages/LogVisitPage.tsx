import { useState } from "react";
import { API_BASE } from "../api/config";
import { getToken } from "../api/auth";

export default function LogVisitPage() {
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [raiseTicket, setRaiseTicket] = useState(false);
  const [ticketType, setTicketType] = useState<"standard" | "emergency">("standard");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const form = new FormData();
    form.append("clientId", clientId);
    form.append("notes", notes);
    if (photo) form.append("photo", photo);
    if (video) form.append("video", video);
    if (raiseTicket) {
      form.append("raiseTicket", "true");
      form.append("ticketType", ticketType);
    }

    try {
      const res = await fetch(`${API_BASE}/visits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: form,
      });
      if (res.ok) {
        setStatus(raiseTicket ? "Visit logged and ticket raised." : "Visit logged.");
        setNotes("");
        setPhoto(null);
        setVideo(null);
        setRaiseTicket(false);
        setTicketType("standard");
      } else {
        const body = await res.json().catch(() => ({}));
        setStatus(body.error || "Failed to log visit.");
      }
    } catch {
      setStatus("Failed to log visit — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const succeeded = status?.startsWith("Visit logged");

  return (
    <div>
      <h1>Log a Visit</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Add the reference photo (and a video if useful) from today's visit. If something needs
        follow-up, raise a ticket right here — no need for a separate step.
      </p>
      <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 380 }}>
        <label>
          Client ID
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </label>
        <label>
          Notes
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          Reference photo
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Video (optional)
          <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </label>

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={raiseTicket} onChange={(e) => setRaiseTicket(e.target.checked)} style={{ width: "auto" }} />
            Something needs follow-up — raise a ticket for this visit
          </label>

          {raiseTicket && (
            <label style={{ marginTop: 10 }}>
              Ticket type
              <select value={ticketType} onChange={(e) => setTicketType(e.target.value as "standard" | "emergency")}>
                <option value="standard">Standard</option>
                <option value="emergency">Emergency — needs immediate attention</option>
              </select>
            </label>
          )}
        </div>

        <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Visit"}</button>
        {status && (
          <p style={{ color: succeeded ? "var(--leaves-green-700)" : "var(--leaves-status-open)", fontWeight: 600 }}>
            {status}
          </p>
        )}
      </form>
    </div>
  );
}
