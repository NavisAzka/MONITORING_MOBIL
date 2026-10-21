import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { findLoginMatches } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Autentikasi belum dikonfigurasi. Hubungi pengelola." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const identity = String(body?.identity ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!identity || !password) {
    return NextResponse.json({ error: "Lengkapi email/nama akun dan kata sandi." }, { status: 400 });
  }
  const matchingAccounts = await findLoginMatches(identity, password);
  if (matchingAccounts.length > 1) {
    return NextResponse.json({ error: "Identitas akun tidak unik. Hubungi admin." }, { status: 409 });
  }
  const account = matchingAccounts[0];
  if (!account) return NextResponse.json({ error: "Akun atau kata sandi tidak cocok." }, { status: 401 });
  const response = NextResponse.json({ user: { id: account.id, name: account.name, role: account.role } });
  setSessionCookie(request, response, { id: account.id, name: account.name, role: account.role });
  return response;
}
