import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Bootstraps the system with one team and one login per role so there's
 * something to sign in with immediately after migrating. Change these
 * passwords (or delete these accounts and create real ones via
 * POST /auth/users as the owner) before going anywhere near production.
 */
async function main() {
  const team = await prisma.team.upsert({
    where: { id: "seed-team-1" },
    update: {},
    create: { id: "seed-team-1", name: "Team 1", vehicleReg: "KWT-0001" },
  });

  const users = [
    { email: "owner@leaves.test", name: "Leaves Owner", role: "owner" as const, teamId: null },
    { email: "supervisor@leaves.test", name: "Team Supervisor", role: "supervisor" as const, teamId: team.id },
    { email: "team@leaves.test", name: "Field Team Member", role: "team_member" as const, teamId: team.id },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  console.log("Seeded team + 3 users (owner/supervisor/team_member). Password for all: ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
