import { Router } from "express";
import { prisma } from "../../prisma";
import { requireAuth, requireRole } from "../../middleware/auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// GET /dashboard/supervisor — this team's ticket + visit status
dashboardRouter.get("/supervisor", requireRole("supervisor", "owner"), async (req, res) => {
  const user = req.user!;
  const teamId = user.role === "owner" ? (req.query.teamId as string) : user.teamId!;

  const [openTickets, visitsThisWeek] = await Promise.all([
    prisma.ticket.findMany({ where: { client: { teamId }, status: { not: "resolved" } }, include: { client: true } }),
    prisma.visit.count({
      where: { teamId, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  res.json({ teamId, openTickets, visitsThisWeek });
});

// GET /dashboard/owner — full-business overview
dashboardRouter.get("/owner", requireRole("owner"), async (req, res) => {
  const [clientCount, openTicketCount, visitsThisWeek] = await Promise.all([
    prisma.client.count(),
    prisma.ticket.count({ where: { status: { not: "resolved" } } }),
    prisma.visit.count({ where: { date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ]);
  res.json({ clientCount, openTicketCount, visitsThisWeek });
});
