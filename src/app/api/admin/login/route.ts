import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieValue, checkAdminToken } from "@/lib/admin";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { getIpHash } from "@/lib/session";

export async function POST(req: Request) {
  if (!rateLimit(`admin-login:${(await getIpHash()) ?? "?"}`, 10, 600_000)) return bad("Слишком много попыток", 429);
  const body = await readJson<{ token?: string }>(req);
  const token = body?.token ?? "";
  if (!checkAdminToken(token)) return bad("Неверный токен", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
