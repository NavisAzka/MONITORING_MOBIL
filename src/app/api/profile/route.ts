import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest, setSessionCookie } from "@/lib/auth";
import { findUserById, identityTaken, profileOf, updateProfile } from "@/lib/users";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const user = await findUserById(session.id);
  if (!user) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  return NextResponse.json({ profile: profileOf(user), role: session.role, username: user.username });
}

export async function PUT(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const profile: UserProfile = {
    name: String(body?.name ?? "").trim().slice(0, 100),
    email: String(body?.email ?? "").trim().slice(0, 200),
    phone: String(body?.phone ?? "").trim().slice(0, 40),
    address: String(body?.address ?? "").trim().slice(0, 300),
  };
  if (!profile.name) return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  // Name and email can be typed at login, so they must not collide with another account.
  if (await identityTaken(profile.name, session.id)) return NextResponse.json({ error: "Nama ini sudah dipakai akun lain." }, { status: 409 });
  if (profile.email && await identityTaken(profile.email, session.id)) return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  await updateProfile(session.id, profile);
  const response = NextResponse.json({ profile });
  setSessionCookie(request, response, { ...session, name: profile.name });
  return response;
}
