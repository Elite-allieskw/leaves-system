import { API_BASE } from "./config";

export type Role = "team_member" | "supervisor" | "head_of_maintenance" | "maintenance_manager" | "owner";

export type AuthedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
};

const TOKEN_KEY = "leaves_token";
const USER_KEY = "leaves_user";

export async function login(email: string, password: string): Promise<AuthedUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Login failed");
  }
  const { token, user } = await res.json();
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthedUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthedUser;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Landing dashboard for each role, used right after login. */
export function defaultRouteForRole(role: Role): string {
  switch (role) {
    case "owner":
      return "/dashboard/owner";
    case "supervisor":
    case "head_of_maintenance":
    case "maintenance_manager":
      return "/dashboard/supervisor";
    default:
      return "/clients";
  }
}
