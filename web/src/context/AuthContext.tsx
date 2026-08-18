import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthedUser, getStoredUser, getToken, login as apiLogin, logout as clearSession } from "../api/auth";

type AuthContextValue = {
  user: AuthedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthedUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trust the locally stored session on load. A real deployment could
    // additionally ping /auth/me here to confirm the token is still valid
    // and pick up any role/team change — kept out of Sprint 0 for simplicity.
    if (getToken()) setUser(getStoredUser());
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
