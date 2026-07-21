import { pgTable, serial, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ignoredDuplicatesTable = pgTable("ignored_duplicates", {
  id: serial("id").primaryKey(),
  titolo1: text("titolo1").notNull(),
  titolo2: text("titolo2").notNull(),
  data: date("data", { mode: "string" }),
  creatoIl: timestamp("creato_il", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIgnoredDuplicateSchema = createInsertSchema(ignoredDuplicatesTable).omit({
  id: true,
  creatoIl: true,
});

export type InsertIgnoredDuplicate = z.infer<typeof insertIgnoredDuplicateSchema>;
export type IgnoredDuplicate = typeof ignoredDuplicatesTable.$inferSelect;
