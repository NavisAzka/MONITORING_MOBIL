import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Role, SessionUser } from "@/lib/types";
import { findUserById } from "@/lib/users";

const COOKIE_NAME = "monitoring_session";
const SESSION_AGE = 60 * 60 * 24 * 7;

function secret() {
  return process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-development-secret-change-me");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const now = Date.now();
  const body = Buffer.from(JSON.stringify({ ...user, iat: now, exp: now + SESSION_AGE * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token?: string): (SessionUser & { iat: number }) | null {
  if (!token || !secret()) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Date.now() || !["driver", "passenger", "admin"].includes(payload.role)) return null;
    // Tokens issued before `iat` was added fall back to their computed issue time.
    return { id: payload.id, name: payload.name, role: payload.role as Role, iat: typeof payload.iat === "number" ? payload.iat : payload.exp - SESSION_AGE * 1000 };
  } catch {
    return null;
  }
}

// A signed cookie stays valid only while its account exists and its password has not changed since it was issued.
export async function sessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const session = decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await findUserById(session.id);
  if (!user || user.role !== session.role) return null;
  if (user.passwordChangedAt && session.iat < user.passwordChangedAt.getTime()) return null;
  return { id: user.id, name: user.name, role: user.role };
}

// Browsers drop Secure cookies on plain HTTP, so only mark the cookie Secure when the request arrived over HTTPS.
function isHttps(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return (forwarded ?? request.nextUrl.protocol.replace(":", "")) === "https";
}

export function setSessionCookie(request: NextRequest, response: NextResponse, user: SessionUser) {
  response.cookies.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_AGE,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
}
