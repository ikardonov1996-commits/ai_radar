import { createHash } from "crypto";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}:${process.env.JWT_SECRET ?? ""}`).digest("hex");
}
