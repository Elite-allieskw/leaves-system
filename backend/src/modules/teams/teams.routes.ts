import { Router } from "express";
import { prisma } from "../../prisma";
import { requireAuth } from "../../middleware/auth";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

// GET /teams — used to populate the team filter dropdown on the Clients page.
// Everyone can list teams (just id/name/vehicleReg — no sensitive data).
teamsRouter.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, vehicleReg: true },
    orderBy: { name: "asc" },
  });
  res.json(teams);
});
