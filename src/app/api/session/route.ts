import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: await sessionFromRequest(request) });
}
