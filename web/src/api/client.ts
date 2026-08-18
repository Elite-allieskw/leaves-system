import { getToken, logout } from "./auth";
import { API_BASE } from "./config";

const BASE_URL = API_BASE;

function authHeaders() {
  const token = getToken() ?? "";
  return { Authorization: `Bearer ${token}` };
}

async function handleUnauthorized(res: Response) {
  if (res.status === 401) {
    logout();
    window.location.href = "/login";
  }
}

export async function apiGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    await handleUnauthorized(res);
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await handleUnauthorized(res);
    throw new Error(`POST ${path} failed: ${res.status}`);
  }
  return res.json();
}
