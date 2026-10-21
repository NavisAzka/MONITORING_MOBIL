import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { addMessage, messagesForDriver } from "@/lib/chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function driverIdFor(session: { id: string; role: string }, requestedId?: string | null) {
  if (session.role === "driver") return session.id;
  if (session.role === "admin" && requestedId && (await findUserById(requestedId))?.role === "driver") return requestedId;
  return null;
}

export async function GET(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const driverId = await driverIdFor(session, request.nextUrl.searchParams.get("driverId"));
  if (!driverId) return NextResponse.json({ error: "Percakapan tidak tersedia." }, { status: 403 });
  return NextResponse.json({ messages: messagesForDriver(driverId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (session.role !== "admin" && session.role !== "driver") {
    return NextResponse.json({ error: "Chat hanya tersedia untuk admin dan sopir." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const driverId = await driverIdFor(session, String(body?.driverId ?? ""));
  const text = String(body?.text ?? "").trim().slice(0, 2000);
  if (!driverId) return NextResponse.json({ error: "Sopir tidak ditemukan." }, { status: 404 });
  if (!text) return NextResponse.json({ error: "Tulis pesan terlebih dahulu." }, { status: 400 });

  const saved = addMessage({
    driverId,
    senderId: session.id,
    senderName: session.name,
    senderRole: session.role,
    text,
  });
  return NextResponse.json({ message: saved }, { status: 201 });
}
