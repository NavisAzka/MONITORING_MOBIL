import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "driver"]);

// Admin and driver accounts, including the profile fields shown in the app.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  role: userRole("role").notNull(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  passwordHash: text("password_hash").notNull(),
  // Sessions issued before this moment are rejected (set when an admin changes the password).
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdBy: text("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
  index("users_role_idx").on(table.role),
]);

// Vehicle metadata managed by admins. GPS vehicles use their IMEI as id; manual ones use "manual-<uuid>".
export const vehicles = pgTable("vehicles", {
  id: text("id").primaryKey(),
  imei: text("imei").unique(),
  name: text("name").notNull(),
  passengerCapacity: integer("passenger_capacity"),
  currentPassengers: integer("current_passengers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("vehicles_capacity_range", sql`${table.passengerCapacity} IS NULL OR ${table.passengerCapacity} BETWEEN 1 AND 100`),
  check("vehicles_current_range", sql`${table.currentPassengers} IS NULL OR ${table.currentPassengers} BETWEEN 0 AND 100`),
]);

// Which driver uses which vehicle. An open assignment has ended_at NULL; closed rows remain as history.
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: text("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  // Vehicle odometer (km) from GPS when the session started/ended; distance = end - start.
  startOdometer: doublePrecision("start_odometer"),
  endOdometer: doublePrecision("end_odometer"),
}, (table) => [
  // One active vehicle per driver and one active driver per vehicle, enforced by the database.
  uniqueIndex("assignments_one_active_vehicle").on(table.vehicleId).where(sql`${table.endedAt} IS NULL`),
  uniqueIndex("assignments_one_active_driver").on(table.driverId).where(sql`${table.endedAt} IS NULL`),
  index("assignments_driver_started_idx").on(table.driverId, table.startedAt),
]);
