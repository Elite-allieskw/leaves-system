import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";

export const authRouter = Router();

const TOKEN_TTL = "7d";

function signToken(user: { id: string; role: string; teamId: string | null }) {
  return jwt.sign(
    { id: user.id, role: user.role, teamId: user.teamId ?? undefined },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: TOKEN_TTL }
  );
}

// POST /auth/login — email + password, returns a JWT + basic profile
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId },
  });
});

// GET /auth/me — resolves the current token against fresh DB data
// (so a role/team change takes effect without waiting for the token to expire)
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId });
});

// POST /auth/users — owner-only: create a new user (team member, supervisor, etc.)
// This is an internal tool, so there's no public self-signup — accounts are provisioned by the owner.
authRouter.post("/users", requireAuth, requireRole("owner"), async (req, res) => {
  const { name, email, password, role, teamId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, and role are required" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, teamId },
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId });
});
