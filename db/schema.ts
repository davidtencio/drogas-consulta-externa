import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pharmacists = sqliteTable("pharmacists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  license: text("license").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const medicines = sqliteTable("medicines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  strength: text("strength").notNull(),
  form: text("form").notNull(),
  unit: text("unit").notNull(),
  stock: integer("stock").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  lot: text("lot").notNull().default(""),
  expiresAt: text("expires_at").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  medicineId: integer("medicine_id").notNull().references(() => medicines.id),
  type: text("type", { enum: ["IN", "OUT"] }).notNull(),
  quantity: integer("quantity").notNull(),
  prescriptionRef: text("prescription_ref").notNull().default(""),
  pharmacistEmail: text("pharmacist_email").notNull(),
  createdAt: text("created_at").notNull(),
});
