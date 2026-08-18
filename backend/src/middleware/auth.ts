import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedUser {
  id: string;
  role: "team_member" | "supervisor" | "head_of_maintenance" | "maintenance_manager" | "owner";
  teamId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/** Verifies the JWT and attaches the user to the request. Sprint 0 stub — real login flow comes with it. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  try {
    const token = header.slice("Bearer ".length);
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as AuthedUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Restricts a route to specific roles. Use after requireAuth. */
export function requireRole(...roles: AuthedUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized for this resource" });
    }
    next();
  };
}
