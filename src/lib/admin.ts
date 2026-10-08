import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "ar_admin";

export function adminCookieValue(token: string) {
  return createHash("sha256").update(`admin:${token}`).digest("hex");
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminToken(token: string) {
  const expected = process.env.ADMIN_TOKEN;
  return !!expected && safeEq(token, expected);
}

export async function isAdmin() {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!v && safeEq(v, adminCookieValue(expected));
}
