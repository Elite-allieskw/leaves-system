import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Demo/sample data — NOT real Leaves clients. Everything here is fictional,
 * clearly labeled "[DEMO]", so it's obvious at a glance in the UI and safe
 * to run against a staging database. Use this to test the app end-to-end
 * (client list, garden profiles, visit history, tickets, dashboards) before
 * the real 120-client migration is built.
 *
 * Run with: npm run prisma:seed:demo
 * (Run `npm run prisma:seed` first if you haven't — this script assumes the
 * owner/supervisor/team_member logins from that seed already exist.)
 */

const GARDEN_THEMES = [
  "Modern minimalist",
  "Mediterranean",
  "Desert-native xeriscape",
  "Tropical resort",
  "Formal classic",
  "Contemporary courtyard",
];

const VALUABLE_PLANTS = [
  ["Olive tree", "Lavender hedge"],
  ["Date palm", "Bougainvillea"],
  ["Washingtonia palm", "Rosemary border"],
  ["Olive tree", "Date palm"],
  ["Frangipani", "Jasmine vine"],
  ["Ghaf tree", "Desert rose"],
];

const CONTRACT_TYPES = ["three_month", "yearly"] as const;

async function main() {
  // 6 teams (matches "6 cars for maintenance" from the business scale doc)
  const teams = [];
  for (let i = 1; i <= 6; i++) {
    const team = await prisma.team.upsert({
      where: { id: `demo-team-${i}` },
      update: {},
      create: { id: `demo-team-${i}`, name: `Team ${i}`, vehicleReg: `KWT-DEMO-${String(i).padStart(3, "0")}` },
    });
    teams.push(team);
  }

  // A field-team-member login per team, so ticket "raisedBy"/assignment has a real user to point to
  const teamUsers = [];
  for (const team of teams) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const user = await prisma.user.upsert({
      where: { email: `${team.id}@leaves.test` },
      update: {},
      create: {
        email: `${team.id}@leaves.test`,
        name: `[DEMO] ${team.name} Member`,
        role: "team_member",
        teamId: team.id,
        passwordHash,
      },
    });
    teamUsers.push(user);
  }

  const supervisor = await prisma.user.findUnique({ where: { email: "supervisor@leaves.test" } });

  // 15 fictional clients, spread across the 6 teams, with varied garden profiles
  for (let i = 1; i <= 15; i++) {
    const team = teams[i % teams.length];
    const theme = GARDEN_THEMES[i % GARDEN_THEMES.length];
    const plants = VALUABLE_PLANTS[i % VALUABLE_PLANTS.length];
    const contractType = CONTRACT_TYPES[i % 2];

    const client = await prisma.client.upsert({
      where: { id: `demo-client-${i}` },
      update: {},
      create: {
        id: `demo-client-${i}`,
        name: `[DEMO] Villa ${i} — Sample Client`,
        contactEmail: `demo.client${i}@example.test`,
        contactPhone: `+965 5000 00${String(i).padStart(2, "0")}`,
        address: `Block ${((i % 12) + 1)}, Street ${((i * 3) % 40) + 1}, Kuwait (demo address)`,
        contractType,
        contractStart: new Date(Date.UTC(2026, (i % 12), 1)),
        visitFrequency: "weekly",
        teamId: team.id,
        gardenProfile: {
          create: {
            size: `${300 + i * 40} m²`,
            shape: i % 2 === 0 ? "Rectangular" : "L-shaped",
            theme,
            valuablePlants: plants,
            specialTreatmentNotes: i % 3 === 0 ? "Requires extra shading during peak summer heat." : null,
          },
        },
      },
    });

    // Give each client one or two sample visits, so history/dashboards aren't empty
    const visit1 = await prisma.visit.upsert({
      where: { id: `demo-visit-${i}-1` },
      update: {},
      create: {
        id: `demo-visit-${i}-1`,
        clientId: client.id,
        teamId: team.id,
        date: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
        notes: "[DEMO] Routine weekly maintenance — trimming, weeding, irrigation check.",
        status: "completed",
      },
    });

    if (i % 3 === 0) {
      // Every third client gets a follow-up visit + an open ticket, for dashboard variety
      await prisma.visit.upsert({
        where: { id: `demo-visit-${i}-2` },
        update: {},
        create: {
          id: `demo-visit-${i}-2`,
          clientId: client.id,
          teamId: team.id,
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          notes: "[DEMO] Noticed irrigation drip issue near the east bed — flagged as a ticket.",
          status: "needs_followup",
        },
      });

      await prisma.ticket.upsert({
        where: { id: `demo-ticket-${i}` },
        update: {},
        create: {
          id: `demo-ticket-${i}`,
          clientId: client.id,
          visitId: `demo-visit-${i}-2`,
          raisedBy: "team_member",
          type: i % 6 === 0 ? "emergency" : "standard",
          status: i % 2 === 0 ? "open" : "in_progress",
          assignedToId: supervisor?.id,
        },
      });
    } else {
      void visit1; // keep reference so TS doesn't flag it as unused in this branch
    }
  }

  console.log("Seeded 6 demo teams and 15 demo clients (with garden profiles, sample visits, and a few tickets).");
  console.log("Everything here is fictional test data, prefixed [DEMO] — safe to reset/delete at any time.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
