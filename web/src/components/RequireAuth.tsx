import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Role } from "../api/auth";

/**
 * Wrap a route element with this to require login (and optionally specific roles).
 * Redirects to /login, preserving the originally requested path so we can
 * bounce back after a successful sign-in.
 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p>Loading…</p>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <p>You don't have access to this page.</p>;
  }

  return <>{children}</>;
}
