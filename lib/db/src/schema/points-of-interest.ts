import { pgTable, serial, text, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Punti di interesse (nuraghi, chiese, grotte, cantine, ecc.) da mostrare
 * vicino a un evento o lungo il tragitto per raggiungerlo. Stesso pattern
 * di events/pending_events: import grezzo in revisione, poi pubblicato -
 * niente viene mostrato ai visitatori finche' non e' stato controllato.
 */

export const puntiInteressePendingTable = pgTable("punti_interesse_pending", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  categoria: text("categoria").notNull(),
  comune: text("comune"),
  provincia: text("provincia"),
  latitudine: real("latitudine").notNull(),
  longitudine: real("longitudine").notNull(),
  descrizione: text("descrizione"),
  linkEsterno: text("link_esterno"),
  fonteOsm: text("fonte_osm"), // es. "node/123456", per evitare duplicati se si rilancia l'import
  tagOsmGrezzi: jsonb("tag_osm_grezzi"),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const puntiInteresseTable = pgTable("punti_interesse", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  categoria: text("categoria").notNull(),
  comune: text("comune"),
  provincia: text("provincia"),
  latitudine: real("latitudine").notNull(),
  longitudine: real("longitudine").notNull(),
  descrizione: text("descrizione"),
  immagine: text("immagine"),
  linkEsterno: text("link_esterno"),
  isPartner: boolean("is_partner").notNull().default(false),
  pubblicatoIl: timestamp("pubblicato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPuntoInteressePendingSchema = createInsertSchema(puntiInteressePendingTable).omit({
  id: true,
  creatoIl: true,
});

export const insertPuntoInteresseSchema = createInsertSchema(puntiInteresseTable).omit({
  id: true,
  pubblicatoIl: true,
});

export type InsertPuntoInteressePending = z.infer<typeof insertPuntoInteressePendingSchema>;
export type InsertPuntoInteresse = z.infer<typeof insertPuntoInteresseSchema>;
export type PuntoInteressePending = typeof puntiInteressePendingTable.$inferSelect;
export type PuntoInteresse = typeof puntiInteresseTable.$inferSelect;
