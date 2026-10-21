import { readFileSync } from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { hashPassword } from "@/lib/password";

type EnvAccount = { id: string; name: string; password: string; email?: string; username?: string };
type Role = "admin" | "driver";

// Local demo accounts, used only outside production when no *_ACCOUNTS_JSON is configured.
function developmentAccounts(): Array<EnvAccount & { role: Role }> {
  return [
    { id: "driver-budi", name: "Budi Santoso", role: "driver", password: "sopir123" },
    { id: "driver-siti", name: "Siti Rahma", role: "driver", password: "sopir123" },
    { id: "driver-sopir", name: "Sopir", username: "sopir", role: "driver", password: "123" },
    { id: "admin-default", name: "Admin", username: "admin", role: "admin", password: "123" },
  ];
}

function envAccounts(variable: string): EnvAccount[] | null {
  const value = process.env[variable];
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.password === "string") : null;
  } catch { return null; }
}

function legacyJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path.join(process.cwd(), ".data", file), "utf8")) as T; }
  catch { return fallback; }
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 32) || "user";
}

/**
 * Runs once, on an empty database: imports accounts from .env (or demo accounts in development) and the
 * previous JSON files in .data (driver accounts, profiles, fleet metadata, current assignments).
 */
export async function importLegacyData(db: NodePgDatabase<typeof schema>) {
  await db.transaction(async (tx) => {
    // Serialise concurrent first requests; the lock is released when the transaction ends.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4823001)`);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(schema.users);
    if (count > 0) return;

    const admins = envAccounts("ADMIN_ACCOUNTS_JSON");
    const drivers = envAccounts("DRIVER_ACCOUNTS_JSON");
    const accounts: Array<EnvAccount & { role: Role }> = !admins && !drivers && process.env.NODE_ENV !== "production"
      ? developmentAccounts()
      : [...(admins ?? []).map((item) => ({ ...item, role: "admin" as const })), ...(drivers ?? []).map((item) => ({ ...item, role: "driver" as const }))];

    const profiles = legacyJson<Record<string, { name?: string; email?: string; phone?: string; address?: string }>>("profiles.json", {});
    const usedUsernames = new Set<string>();
    const uniqueUsername = (wanted: string) => {
      let candidate = slug(wanted);
      for (let n = 2; usedUsernames.has(candidate); n += 1) candidate = `${slug(wanted).slice(0, 29)}${n}`;
      usedUsernames.add(candidate);
      return candidate;
    };
    const rows: Array<typeof schema.users.$inferInsert> = accounts.map((account) => {
      const profile = profiles[account.id] ?? {};
      return {
        id: account.id,
        role: account.role,
        username: uniqueUsername(account.username || account.email?.split("@")[0] || account.name),
        name: profile.name || account.name,
        email: profile.email || account.email || null,
        phone: profile.phone || null,
        address: profile.address || null,
        passwordHash: hashPassword(account.password),
      };
    });
    // Driver accounts an admin created in the app before the database existed (already hashed).
    for (const stored of legacyJson<Array<{ id: string; name: string; username: string; passwordHash: string; passwordChangedAt?: number; createdAt?: number }>>("drivers.json", [])) {
      if (rows.some((row) => row.id === stored.id)) continue;
      const profile = profiles[stored.id] ?? {};
      rows.push({
        id: stored.id,
        role: "driver",
        username: uniqueUsername(stored.username),
        name: profile.name || stored.name,
        email: profile.email || null,
        phone: profile.phone || null,
        address: profile.address || null,
        passwordHash: stored.passwordHash,
        passwordChangedAt: stored.passwordChangedAt ? new Date(stored.passwordChangedAt) : null,
        createdAt: stored.createdAt ? new Date(stored.createdAt) : undefined,
      });
    }
    if (rows.length) await tx.insert(schema.users).values(rows);

    const fleet = legacyJson<Array<{ id: string; name: string; passengerCapacity?: number | null; currentPassengers?: number | null }>>("fleet.json", []);
    const vehicleRows = new Map<string, typeof schema.vehicles.$inferInsert>();
    for (const item of fleet) {
      if (typeof item?.id !== "string" || typeof item?.name !== "string") continue;
      vehicleRows.set(item.id, { id: item.id, imei: item.id.startsWith("manual-") ? null : item.id, name: item.name, passengerCapacity: item.passengerCapacity ?? null, currentPassengers: item.currentPassengers ?? null });
    }
    const legacyAssignments = legacyJson<Record<string, { driverId: string; startedAt?: number }>>("assignments.json", {});
    const userIds = new Set(rows.map((row) => row.id));
    const assignmentRows: Array<typeof schema.assignments.$inferInsert> = [];
    const assignedDrivers = new Set<string>();
    for (const [vehicleId, assignment] of Object.entries(legacyAssignments)) {
      if (!userIds.has(assignment?.driverId) || assignedDrivers.has(assignment.driverId)) continue;
      if (!vehicleRows.has(vehicleId)) vehicleRows.set(vehicleId, { id: vehicleId, imei: vehicleId.startsWith("manual-") ? null : vehicleId, name: `Kendaraan ${vehicleId.slice(-4)}` });
      assignedDrivers.add(assignment.driverId);
      assignmentRows.push({ driverId: assignment.driverId, vehicleId, startedAt: assignment.startedAt ? new Date(assignment.startedAt) : undefined });
    }
    if (vehicleRows.size) await tx.insert(schema.vehicles).values([...vehicleRows.values()]);
    if (assignmentRows.length) await tx.insert(schema.assignments).values(assignmentRows);
    console.info(`[db] Data awal diimpor: ${rows.length} akun, ${vehicleRows.size} kendaraan, ${assignmentRows.length} penugasan.`);
  });
}
