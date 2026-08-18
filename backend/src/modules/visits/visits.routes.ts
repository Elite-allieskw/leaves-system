import { Router } from "express";
import multer from "multer";
import { prisma } from "../../prisma";
import { requireAuth } from "../../middleware/auth";
import { uploadFile } from "../../lib/storage";
import { notifyNewTicket } from "../../lib/notify";

export const visitsRouter = Router();
visitsRouter.use(requireAuth);

// Files land in memory, not disk — uploadFile() streams them straight to
// object storage (or the local-disk fallback in dev). 25MB covers photos
// comfortably; video capture (Phase 2) will likely need a higher limit and
// probably a presigned direct-to-storage upload instead of proxying through
// the API — revisit this when video capture is actually built.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// POST /visits — log a visit with a reference photo (and optionally a video),
// and optionally raise a ticket for it in the same request (Sprint 2:
// team-raised tickets only — client-raised comes in Phase 3).
visitsRouter.post(
  "/",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    const { clientId, notes, raiseTicket, ticketType, ticketNotes } = req.body;
    const files = req.files as { photo?: Express.Multer.File[]; video?: Express.Multer.File[] } | undefined;

    try {
      // The visit (and any ticket raised from it) is attributed to the
      // *client's* team, not the logging user's team. The Supervisor
      // dashboard scopes both visits and tickets by the client's team, so
      // using the user's team here would let a visit/ticket silently vanish
      // from the dashboard of the team that actually owns the client
      // whenever someone logs a visit for a client outside their own team.
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { teamId: true } });
      if (!client) {
        return res.status(404).json({ error: "Client not found." });
      }
      if (!client.teamId) {
        return res.status(400).json({ error: "This client has no team assigned — assign a team before logging visits." });
      }
      const teamId = client.teamId;

      const photoFile = files?.photo?.[0];
      const videoFile = files?.video?.[0];

      const referencePhotoUrl = photoFile
        ? await uploadFile(`visits/${clientId}`, {
            buffer: photoFile.buffer,
            originalName: photoFile.originalname,
            mimeType: photoFile.mimetype,
          })
        : undefined;

      const videoUrl = videoFile
        ? await uploadFile(`visits/${clientId}`, {
            buffer: videoFile.buffer,
            originalName: videoFile.originalname,
            mimeType: videoFile.mimetype,
          })
        : undefined;

      const shouldRaiseTicket = raiseTicket === "true" || raiseTicket === true;
      const resolvedTicketType = ticketType === "emergency" ? "emergency" : "standard";

      const visit = await prisma.visit.create({
        data: {
          clientId,
          teamId,
          notes,
          referencePhotoUrl,
          videoUrl,
          status: shouldRaiseTicket ? "needs_followup" : "completed",
          tickets: shouldRaiseTicket
            ? {
                create: {
                  clientId,
                  raisedBy: "team_member",
                  type: resolvedTicketType,
                  status: "open",
                },
              }
            : undefined,
        },
        include: { tickets: true, client: { select: { name: true } } },
      });

      const newTicket = visit.tickets[0];
      if (newTicket) {
        // Fire-and-forget — a notification hiccup shouldn't fail the visit save.
        notifyNewTicket({
          ticketId: newTicket.id,
          clientName: visit.client.name,
          type: newTicket.type,
          notes: ticketNotes || notes,
        }).catch((err) => console.error("notifyNewTicket failed:", err));
      }

      res.status(201).json(visit);
    } catch (err) {
      console.error("Failed to log visit:", err);
      res.status(500).json({ error: "Failed to upload media or save the visit. Please try again." });
    }
  }
);

// GET /visits/client/:clientId — visit history for a client
visitsRouter.get("/client/:clientId", async (req, res) => {
  const visits = await prisma.visit.findMany({
    where: { clientId: req.params.clientId },
    orderBy: { date: "desc" },
    include: { tickets: true, report: true },
  });
  res.json(visits);
});
