import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Errori JavaScript non gestiti catturati sul dispositivo del visitatore
 * (dall'ErrorBoundary o dai listener globali window.onerror/unhandledrejection)
 * e inviati qui cosi' da poterli vedere noi, invece di dipendere dal fatto
 * che l'utente apra la console del browser e ci mandi uno screenshot.
 *
 * "codice" e' un hash breve calcolato lato client da messaggio+stack: stesso
 * errore ricorrente = stesso codice, cosi' si vede subito quanto e' diffuso
 * un problema invece di avere solo righe scollegate tra loro.
 */
export const clientErrorsTable = pgTable("client_errors", {
  id: serial("id").primaryKey(),
  codice: text("codice").notNull(),
  messaggio: text("messaggio").notNull(),
  stack: text("stack"),
  componentStack: text("component_stack"),
  url: text("url"),
  userAgent: text("user_agent"),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientErrorSchema = createInsertSchema(clientErrorsTable).omit({
  id: true,
  creatoIl: true,
});

export type InsertClientError = z.infer<typeof insertClientErrorSchema>;
export type ClientError = typeof clientErrorsTable.$inferSelect;
