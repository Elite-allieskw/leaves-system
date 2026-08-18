import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";

type Team = { id: string; name: string; vehicleReg: string };
type Client = {
  id: string;
  name: string;
  address: string;
  contractType: string;
  team?: Team;
  gardenProfile?: { theme?: string; valuablePlants: string[] };
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [plantOptions, setPlantOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [teamId, setTeamId] = useState("");
  const [contractType, setContractType] = useState("");
  const [plant, setPlant] = useState("");

  useEffect(() => {
    Promise.all([apiGet("/teams"), apiGet("/clients/meta/plant-options")])
      .then(([teamsRes, plantsRes]) => {
        setTeams(teamsRes);
        setPlantOptions(plantsRes);
      })
      .catch(() => {
        /* filters are a nice-to-have — if these fail, the list itself still loads below */
      });
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (teamId) params.set("teamId", teamId);
    if (contractType) params.set("contractType", contractType);
    if (plant) params.set("plant", plant);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [q, teamId, contractType, plant]);

  useEffect(() => {
    // Every keystroke fires its own request here (no debounce), and with no
    // cancellation, responses can resolve out of order — a stale request for
    // an earlier keystroke can land after a newer one and overwrite it with
    // wrong (including empty) results. Guard against that.
    let cancelled = false;
    setLoading(true);
    apiGet(`/clients${query}`)
      .then((result) => {
        if (!cancelled) setClients(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const hasFilters = q || teamId || contractType || plant;

  return (
    <div>
      <h1>Clients</h1>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <label style={{ flex: "1 1 200px" }}>
          Search by name
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Villa 4" />
        </label>
        <label style={{ flex: "1 1 160px" }}>
          Team
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.vehicleReg})</option>
            ))}
          </select>
        </label>
        <label style={{ flex: "1 1 160px" }}>
          Contract
          <select value={contractType} onChange={(e) => setContractType(e.target.value)}>
            <option value="">Any</option>
            <option value="three_month">3-month</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <label style={{ flex: "1 1 200px" }}>
          Valuable plant
          <select value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">Any</option>
            {plantOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setQ(""); setTeamId(""); setContractType(""); setPlant(""); }}
            style={{ alignSelf: "flex-end", background: "transparent", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        {loading ? "Loading…" : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
      </p>

      <table>
        <thead>
          <tr><th>Name</th><th>Address</th><th>Team</th><th>Contract</th><th>Garden Theme</th><th>Valuable Plants</th></tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/clients/${c.id}`}>{c.name}</Link></td>
              <td>{c.address}</td>
              <td>{c.team?.name ?? "—"}</td>
              <td style={{ textTransform: "capitalize" }}>{c.contractType?.replace("_", "-")}</td>
              <td>{c.gardenProfile?.theme ?? "—"}</td>
              <td>{c.gardenProfile?.valuablePlants?.join(", ") || "—"}</td>
            </tr>
          ))}
          {!loading && clients.length === 0 && (
            <tr><td colSpan={6} style={{ color: "var(--color-text-muted)" }}>No clients match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
