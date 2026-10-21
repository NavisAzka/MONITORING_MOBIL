import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, sessionFromRequest } from "@/lib/auth";
import { findUserById, identityTaken, updateAdminCredentials } from "@/lib/users";
import { verifyPasswordHash } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Pengaturan ini hanya tersedia untuk admin." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Username harus 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung." }, { status: 400 });
  }
  if (!currentPassword) return NextResponse.json({ error: "Masukkan password saat ini untuk mengonfirmasi perubahan." }, { status: 400 });
  if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) {
    return NextResponse.json({ error: "Password baru harus 8–128 karakter." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) return NextResponse.json({ error: "Konfirmasi password baru tidak cocok." }, { status: 400 });

  const admin = await findUserById(session.id);
  if (!admin || admin.role !== "admin" || !verifyPasswordHash(currentPassword, admin.passwordHash)) {
    return NextResponse.json({ error: "Password saat ini salah." }, { status: 401 });
  }
  if (await identityTaken(username, session.id)) {
    return NextResponse.json({ error: "Username sudah digunakan akun lain." }, { status: 409 });
  }

  try {
    const updated = await updateAdminCredentials(session.id, username, newPassword || undefined);
    if (!updated.length) return NextResponse.json({ error: "Akun admin tidak ditemukan." }, { status: 404 });
    const response = NextResponse.json({ username, passwordChanged: Boolean(newPassword) });
    if (newPassword) clearSessionCookie(response);
    return response;
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return NextResponse.json({ error: "Username sudah digunakan akun lain." }, { status: 409 });
    throw error;
  }
}
