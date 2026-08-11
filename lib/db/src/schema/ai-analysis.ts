import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Registro completo e non modificato di ogni risposta AI (schema unificato v2.0).
 * Una riga per ogni analisi eseguita (Analizza singolo, Crawler AI profondo, PDF).
 * Le colonne rispecchiano ESATTAMENTE i blocchi di primo livello del JSON che
 * l'AI restituisce - nessuno spezzettamento, nessuna perdita di campi lungo la
 * strada. E' la fonte di verita' indipendente dalle colonne "operative" di
 * events/pending_events (che restano solo per filtri e visualizzazione).
 */
export const aiAnalysisTable = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),

  // Riferimento debole (nessun FK) alla riga collegata: un evento in attesa
  // puo' diventare un evento pubblicato, e questa riga deve sopravvivere al
  // passaggio senza essere cancellata a cascata.
  pendingEventId: integer("pending_event_id"),
  eventId: integer("event_id"),

  schemaVersion: text("schema_version"),
  metadatiOperazioni: jsonb("metadati_operazioni"),
  gestioneGerarchia: jsonb("gestione_gerarchia"),
  datiCuratiAi: jsonb("dati_curati_ai"),
  diarioDiBordoAi: jsonb("diario_di_bordo_ai"),
  listaSottoEventiEstratti: jsonb("lista_sotto_eventi_estratti"),

  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
});

export type AiAnalysis = typeof aiAnalysisTable.$inferSelect;
export type InsertAiAnalysis = typeof aiAnalysisTable.$inferInsert;
