import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { bad, readJson } from "@/lib/http";
import { CODE_REQUESTS_PER_HOUR, CODE_TTL_MS } from "@/lib/config";
import { sendLoginCode } from "@/lib/email";
import { EMAIL_RE, hashCode } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await readJson<{ email?: string }>(req);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return bad("Проверь адрес почты");

  const recent = await prisma.emailCode.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= CODE_REQUESTS_PER_HOUR) return bad("Слишком много запросов кода. Попробуй через час", 429);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailCode.create({
    data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  try {
    await sendLoginCode(email, code);
  } catch (e) {
    console.error(e);
    return bad("Не получилось отправить письмо. Попробуй ещё раз", 502);
  }
  return NextResponse.json({ ok: true });
}
