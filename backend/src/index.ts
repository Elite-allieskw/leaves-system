import express from "express";
import cors from "cors";
import "dotenv/config";

import { authRouter } from "./modules/auth/auth.routes";
import { clientsRouter } from "./modules/clients/clients.routes";
import { visitsRouter } from "./modules/visits/visits.routes";
import { ticketsRouter } from "./modules/tickets/tickets.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { teamsRouter } from "./modules/teams/teams.routes";

const app = express();

// In staging/production, set CORS_ORIGIN to the deployed frontend's URL so only
// that origin can call the API. Falls back to "*" for local dev convenience.
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/clients", clientsRouter);
app.use("/visits", visitsRouter);
app.use("/tickets", ticketsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/teams", teamsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Leaves backend listening on :${port}`));
