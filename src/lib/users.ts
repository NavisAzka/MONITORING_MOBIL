import { randomUUID } from "crypto";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hashPassword, verifyPasswordHash } from "@/lib/password";
import type { UserProfile } from "@/lib/types";

const { users } = schema;
export type UserRow = typeof users.$inferSelect;

export async function findUserById(id: string) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

function identityMatches(value: string) {
  const lower = value.toLowerCase();
  return or(eq(sql`lower(${users.username})`, lower), eq(sql`lower(${users.email})`, lower), eq(sql`lower(${users.name})`, lower));
}

// Login accepts username, email, or full name (case-insensitive).
export async function findLoginMatches(identity: string, password: string) {
  const db = await getDb();
  const candidates = await db.select().from(users).where(identityMatches(identity));
  return candidates.filter((user) => verifyPasswordHash(password, user.passwordHash));
}

// True when the value is already a login identity (username, email, or name) of another account.
export async function identityTaken(value: string, exceptId?: string) {
  const db = await getDb();
  const matches = await db.select({ id: users.id }).from(users).where(identityMatches(value));
  return matches.some((match) => match.id !== exceptId);
}

export async function listDrivers() {
  const db = await getDb();
  return db.select().from(users).where(eq(users.role, "driver")).orderBy(asc(users.name));
}

export async function createDriver(input: { name: string; username: string; password: string; phone: string; createdBy: string }) {
  const db = await getDb();
  const [driver] = await db.insert(users).values({
    id: `driver-${randomUUID()}`,
    role: "driver",
    name: input.name,
    username: input.username,
    phone: input.phone || null,
    passwordHash: hashPassword(input.password),
    createdBy: input.createdBy,
  }).returning();
  return driver;
}

export async function changeDriverPassword(id: string, password: string) {
  const db = await getDb();
  const updated = await db.update(users).set({ passwordHash: hashPassword(password), passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.role, "driver"))).returning({ id: users.id });
  return updated.length > 0;
}

export async function updateAdminCredentials(id: string, username: string, newPassword?: string) {
  const db = await getDb();
  const values: { username: string; passwordHash?: string; passwordChangedAt?: Date; updatedAt: Date } = {
    username,
    updatedAt: new Date(),
  };
  if (newPassword) {
    values.passwordHash = hashPassword(newPassword);
    values.passwordChangedAt = new Date();
  }
  return db.update(users).set(values).where(and(eq(users.id, id), eq(users.role, "admin"))).returning({ id: users.id });
}

// Deleting a driver also removes their assignments (ON DELETE CASCADE), which frees the vehicle.
export async function deleteDriver(id: string) {
  const db = await getDb();
  const deleted = await db.delete(users).where(and(eq(users.id, id), eq(users.role, "driver"))).returning({ id: users.id });
  return deleted.length > 0;
}

export function profileOf(user: UserRow): UserProfile {
  return { name: user.name, email: user.email ?? "", phone: user.phone ?? "", address: user.address ?? "" };
}

export async function updateProfile(id: string, profile: UserProfile) {
  const db = await getDb();
  await db.update(users).set({ name: profile.name, email: profile.email || null, phone: profile.phone || null, address: profile.address || null, updatedAt: new Date() })
    .where(eq(users.id, id));
}
