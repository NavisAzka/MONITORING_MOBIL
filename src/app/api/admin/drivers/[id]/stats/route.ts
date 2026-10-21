import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { driverStats, STATS_PERIODS, type StatsPeriod } from "@/lib/driverStats";
import { findUserById } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Fitur ini hanya tersedia untuk admin." }, { status: 403 });
  const driver = await findUserById(params.id);
  if (!driver || driver.role !== "driver") return NextResponse.json({ error: "Sopir tidak ditemukan." }, { status: 404 });
  const requested = request.nextUrl.searchParams.get("period") ?? "today";
  const period: StatsPeriod = (STATS_PERIODS as string[]).includes(requested) ? requested as StatsPeriod : "today";
  return NextResponse.json(await driverStats(params.id, period), { headers: { "Cache-Control": "no-store" } });
}
