import { pgTable, serial, text, date, real, timestamp, integer, AnyPgColumn } from "drizzle-orm/pg-core";
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
  linkOrganizzatore: text("link_organizzatore"),
  descrizione: text("descrizione"),
  immagine: text("immagine"),
  fonte: text("fonte").notNull().default(""),
  testoEstratto: text("testo_estratto"),
  parentId: integer("parent_id").references((): AnyPgColumn => eventsTable.id, { onDelete: "cascade" }),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  aggiornatoIl: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
