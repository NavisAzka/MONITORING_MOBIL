import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { findUserById } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await sessionFromRequest(request))) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const driver = await findUserById(params.id);
  if (!driver || driver.role !== "driver") return NextResponse.json({ error: "Data sopir tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ driver: { id: driver.id, name: driver.name, phone: driver.phone ?? "" } }, { headers: { "Cache-Control": "no-store" } });
}
