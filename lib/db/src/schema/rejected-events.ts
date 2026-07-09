import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rejectedEventsTable = pgTable("rejected_events", {
  id: serial("id").primaryKey(),
  titolo: text("titolo").notNull(),
  fonte: text("fonte").notNull(),
  motivo: text("motivo"),
  rifiutatoIl: timestamp("rifiutato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRejectedEventSchema = createInsertSchema(rejectedEventsTable).omit({
  id: true,
  rifiutatoIl: true,
});

export type InsertRejectedEvent = z.infer<typeof insertRejectedEventSchema>;
export type RejectedEvent = typeof rejectedEventsTable.$inferSelect;
