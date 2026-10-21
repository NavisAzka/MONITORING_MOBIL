import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { changeDriverPassword, deleteDriver } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function admin(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Fitur ini hanya tersedia untuk admin." }, { status: 403 });
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await admin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "Kata sandi minimal 8 karakter." }, { status: 400 });
  if (!(await changeDriverPassword(params.id, password))) return NextResponse.json({ error: "Sopir tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Deleting the account cascades to its assignments, so the vehicle becomes free immediately.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await admin(request);
  if (denied) return denied;
  if (!(await deleteDriver(params.id))) return NextResponse.json({ error: "Sopir tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
