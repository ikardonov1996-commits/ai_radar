import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./db";

export const SESSION_COOKIE = "ar_session";
export const ANON_COOKIE = "ar_anon";
const SESSION_DAYS = 90;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function getUser() {
  const id = await getUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

const ANON_RE = /^[a-zA-Z0-9-]{8,64}$/;

/** Anonymous device id: set by middleware, mirrored to localStorage by the client. */
export async function getAnonId(): Promise<string> {
  const v = (await cookies()).get(ANON_COOKIE)?.value;
  if (v && ANON_RE.test(v)) return v;
  return "unknown";
}

export async function getIdentity() {
  const [userId, anonId] = await Promise.all([getUserId(), getAnonId()]);
  return { userId, anonId };
}

export async function getIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`${ip}:${process.env.JWT_SECRET ?? ""}`).digest("hex").slice(0, 32);
}
