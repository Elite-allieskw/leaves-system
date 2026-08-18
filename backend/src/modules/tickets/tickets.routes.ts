import { Router } from "express";
import { prisma } from "../../prisma";
import { requireAuth } from "../../middleware/auth";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

// POST /tickets — raise a ticket, optionally linked to a visit (Sprint 2: team-raised only)
ticketsRouter.post("/", async (req, res) => {
  const { clientId, visitId, type } = req.body;
  const ticket = await prisma.ticket.create({
    data: {
      clientId,
      visitId,
      type: type ?? "standard",
      raisedBy: "team_member",
    },
  });
  // TODO Sprint 4: fire push notification here when type === "emergency"
  res.status(201).json(ticket);
});

// GET /tickets — scoped by team for supervisor, all for manager/owner
ticketsRouter.get("/", async (req, res) => {
  const user = req.user!;
  const scopedToTeam = user.role === "supervisor";
  const tickets = await prisma.ticket.findMany({
    where: scopedToTeam ? { client: { teamId: user.teamId } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { client: true, visit: true, assignedTo: true },
  });
  res.json(tickets);
});

// PATCH /tickets/:id — update status
ticketsRouter.patch("/:id", async (req, res) => {
  const { status, assignedToId } = req.body;
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: {
      status,
      assignedToId,
      resolvedAt: status === "resolved" ? new Date() : undefined,
    },
  });
  res.json(ticket);
});
