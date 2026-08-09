import { pgTable, serial, text, date, real, timestamp, integer, boolean, AnyPgColumn, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  titolo: text("titolo").notNull(),
  titoloOriginale: text("titolo_originale"),
  categoria: text("categoria"),
  dataInizio: date("data_inizio", { mode: "string" }),
  dataFine: date("data_fine", { mode: "string" }),
  dateOriginali: text("date_originali"),
  oraInizio: text("ora_inizio"),
  oraFine: text("ora_fine"),
  luogo: text("luogo"),
  luogoOriginale: text("luogo_originale"),
  latitudine: real("latitudine"),
  longitudine: real("longitudine"),
  link: text("link"),
  linkOrganizzatore: text("link_organizzatore"),
  linkBiglietti: text("link_biglietti"),
  descrizione: text("descrizione"),
  immagine: text("immagine"),
  fonte: text("fonte").notNull().default(""),
  testoEstratto: text("testo_estratto"),
  isFestival: boolean("is_festival").default(false),
  isIngressoGratuito: boolean("is_ingresso_gratuito").default(false),
  parentId: integer("parent_id").references((): AnyPgColumn => eventsTable.id, { onDelete: "cascade" }),
  tags: text("tags").array(),
  artisti: text("artisti").array(),
  bioArtisti: jsonb("bio_artisti"),
  socialContatti: text("social_contatti").array(),
  dettagliExtra: jsonb("dettagli_extra"),
  aggiornatoIl: timestamp("aggiornato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const pendingEventsTable = pgTable("pending_events", {
  id: serial("id").primaryKey(),
  titolo: text("titolo").notNull(),
  titoloOriginale: text("titolo_originale"),
  categoria: text("categoria"),
  dataInizio: date("data_inizio", { mode: "string" }),
  dataFine: date("data_fine", { mode: "string" }),
  dateOriginali: text("date_originali"),
  oraInizio: text("ora_inizio"),
  oraFine: text("ora_fine"),
  luogo: text("luogo"),
  luogoOriginale: text("luogo_originale"),
  latitudine: real("latitudine"),
  longitudine: real("longitudine"),
  link: text("link"),
  linkOrganizzatore: text("link_organizzatore"),
  linkBiglietti: text("link_biglietti"),
  descrizione: text("descrizione"),
  immagine: text("immagine"),
  fonte: text("fonte").notNull().default(""),
  testoEstratto: text("testo_estratto"),
  isFestival: boolean("is_festival").default(false),
  isIngressoGratuito: boolean("is_ingresso_gratuito").default(false),
  parentTempId: text("parent_temp_id"),
  sottoEventi: jsonb("sotto_eventi"),
  tags: text("tags").array(),
  artisti: text("artisti").array(),
  bioArtisti: jsonb("bio_artisti"),
  socialContatti: text("social_contatti").array(),
  dettagliExtra: jsonb("dettagli_extra"),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  aggiornatoIl: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type PendingEvent = typeof pendingEventsTable.$inferSelect;
