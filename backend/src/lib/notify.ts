/**
 * Ticket notifications — Phase 1 does email (Phase 2 adds push via Firebase
 * Cloud Messaging for real mobile alerts, per the build plan).
 *
 * If SMTP isn't configured, falls back to logging to the console so the app
 * still runs end-to-end without email credentials — same pattern as the
 * storage fallback. Don't rely on the console fallback past local dev.
 */

import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const notifyFrom = process.env.NOTIFY_FROM_EMAIL || "no-reply@leaves.test";
const notifyTo = process.env.NOTIFY_TICKETS_TO_EMAIL; // e.g. the supervisor/owner distribution address

const transport = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

export type TicketNotification = {
  ticketId: string;
  clientName: string;
  type: "standard" | "emergency";
  notes?: string;
};

export async function notifyNewTicket(ticket: TicketNotification) {
  const subject =
    ticket.type === "emergency"
      ? `🚨 Emergency ticket — ${ticket.clientName}`
      : `New ticket — ${ticket.clientName}`;
  const body = `A ${ticket.type} ticket was raised for ${ticket.clientName}.\n\n${ticket.notes || "(no notes)"}\n\nTicket ID: ${ticket.ticketId}`;

  if (transport && notifyTo) {
    try {
      await transport.sendMail({ from: notifyFrom, to: notifyTo, subject, text: body });
    } catch (err) {
      // Don't let a notification failure fail the ticket-creation request itself.
      console.error("Failed to send ticket notification email:", err);
    }
    return;
  }

  console.log(`[notify:fallback] ${subject}\n${body}`);
}
