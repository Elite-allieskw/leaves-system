import { Router } from "express";
import { prisma } from "../../prisma";
import { requireAuth } from "../../middleware/auth";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

// GET /clients — list, scoped by team for team_member/supervisor, all clients for manager/owner
// Optional filters: q (name search), teamId, contractType, plant (matches a valuable plant)
clientsRouter.get("/", async (req, res) => {
  const user = req.user!;
  const scopedToTeam = ["team_member", "supervisor"].includes(user.role);
  const { q, teamId, contractType, plant } = req.query as Record<string, string | undefined>;

  const clients = await prisma.client.findMany({
    where: {
      ...(scopedToTeam ? { teamId: user.teamId } : teamId ? { teamId } : {}),
      ...(contractType ? { contractType: contractType as any } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(plant ? { gardenProfile: { valuablePlants: { has: plant } } } : {}),
    },
    include: { gardenProfile: true, team: true },
    orderBy: { name: "asc" },
  });
  res.json(clients);
});

// GET /clients/meta/plant-options — distinct valuable-plant values across all
// garden profiles, so the frontend filter dropdown reflects real data instead
// of a hardcoded list.
clientsRouter.get("/meta/plant-options", async (_req, res) => {
  const profiles: { valuablePlants: string[] }[] = await prisma.gardenProfile.findMany({
    select: { valuablePlants: true },
  });
  const unique = Array.from(new Set(profiles.flatMap((p) => p.valuablePlants))).sort();
  res.json(unique);
});

// GET /clients/:id — full profile including visit/ticket history
clientsRouter.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      gardenProfile: true,
      team: true,
      visits: { orderBy: { date: "desc" }, include: { tickets: true, report: true } },
      tickets: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(client);
});

// POST /clients — create a client + garden profile in one call
clientsRouter.post("/", async (req, res) => {
  const { name, contactEmail, contactPhone, address, contractType, contractStart, teamId, garden } = req.body;
  const client = await prisma.client.create({
    data: {
      name,
      contactEmail,
      contactPhone,
      address,
      contractType,
      contractStart: new Date(contractStart),
      teamId,
      gardenProfile: garden
        ? {
            create: {
              size: garden.size,
              shape: garden.shape,
              theme: garden.theme,
              valuablePlants: garden.valuablePlants ?? [],
              specialTreatmentNotes: garden.specialTreatmentNotes,
            },
          }
        : undefined,
    },
    include: { gardenProfile: true },
  });
  res.status(201).json(client);
});

// PATCH /clients/:id — update client + garden profile fields
clientsRouter.patch("/:id", async (req, res) => {
  const { garden, ...clientFields } = req.body;
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: {
      ...clientFields,
      gardenProfile: garden ? { update: garden } : undefined,
    },
    include: { gardenProfile: true },
  });
  res.json(client);
});
