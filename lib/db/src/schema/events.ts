import { pgTable, serial, text, date, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  titolo: text("titolo").notNull(),
  dataInizio: date("data_inizio", { mode: "string" }),
  dataFine: date("data_fine", { mode: "string" }),
  luogo: text("luogo"),
  latitudine: real("latitudine"),
  longitudine: real("longitudine"),
  link: text("link"),
  descrizione: text("descrizione"),
  immagine: text("immagine"),
  fonte: text("fonte").notNull().default(""),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  aggiornatoIl: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
