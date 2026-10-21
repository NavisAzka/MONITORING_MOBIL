import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { odometerOf } from "@/lib/fleet";

export type StatsPeriod = "today" | "7d" | "30d";
export const STATS_PERIODS: StatsPeriod[] = ["today", "7d", "30d"];

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Start of the period; "today" begins at midnight Asia/Jakarta (UTC+7, no DST).
function periodStart(period: StatsPeriod, now: Date) {
  if (period === "today") {
    const local = new Date(now.getTime() + WIB_OFFSET_MS);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - WIB_OFFSET_MS);
  }
  return new Date(now.getTime() - (period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);
}

/**
 * Session-based statistics from the assignments table. Active time is clipped to the period;
 * distance uses the odometer at the start and end of each overlapping session (whole session).
 */
export async function driverStats(driverId: string, period: StatsPeriod) {
  const db = await getDb();
  const { assignments, vehicles } = schema;
  const now = new Date();
  const from = periodStart(period, now);
  const rows = await db.select({
    id: assignments.id,
    vehicleId: assignments.vehicleId,
    vehicleName: vehicles.name,
    startedAt: assignments.startedAt,
    endedAt: assignments.endedAt,
    startOdometer: assignments.startOdometer,
    endOdometer: assignments.endOdometer,
  }).from(assignments).innerJoin(vehicles, eq(vehicles.id, assignments.vehicleId))
    .where(and(eq(assignments.driverId, driverId), lt(assignments.startedAt, now), or(isNull(assignments.endedAt), gt(assignments.endedAt, from))))
    .orderBy(desc(assignments.startedAt));

  const sessions = await Promise.all(rows.map(async (row) => {
    const end = row.endedAt ?? now;
    const activeSeconds = Math.max(0, Math.round((Math.min(end.getTime(), now.getTime()) - Math.max(row.startedAt.getTime(), from.getTime())) / 1000));
    const endOdometer = row.endedAt ? row.endOdometer : await odometerOf(row.vehicleId);
    const distanceKm = row.startOdometer !== null && endOdometer !== null && endOdometer >= row.startOdometer
      ? Math.round((endOdometer - row.startOdometer) * 100) / 100 : null;
    return {
      id: row.id,
      vehicleName: row.vehicleName,
      startedAt: row.startedAt.getTime(),
      endedAt: row.endedAt?.getTime() ?? null,
      durationSeconds: Math.round((end.getTime() - row.startedAt.getTime()) / 1000),
      activeSeconds,
      distanceKm,
    };
  }));

  return {
    period,
    from: from.getTime(),
    totals: {
      sessions: sessions.length,
      activeSeconds: sessions.reduce((sum, item) => sum + item.activeSeconds, 0),
      distanceKm: Math.round(sessions.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0) * 100) / 100,
      // False when a session lacks odometer data (e.g. manual vehicle or GPS without odometer).
      distanceComplete: sessions.every((item) => item.distanceKm !== null),
    },
    sessions: sessions.slice(0, 20),
  };
}
