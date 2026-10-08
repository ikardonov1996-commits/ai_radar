import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, readJson } from "@/lib/http";
import { CODE_MAX_ATTEMPTS, getConfig } from "@/lib/config";
import { createSession, getAnonId, getIpHash } from "@/lib/session";
import { logEvent } from "@/lib/events";
import { hashCode } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await readJson<{ email?: string; code?: string }>(req);
  const email = (body?.email ?? "").trim().toLowerCase();
  const code = (body?.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return bad("Введи 6 цифр из письма");

  const rec = await prisma.emailCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.expiresAt < new Date()) return bad("Код истёк. Запроси новый", 410);
  if (rec.attempts >= CODE_MAX_ATTEMPTS) return bad("Слишком много попыток. Запроси новый код", 429);

  if (rec.codeHash !== hashCode(email, code)) {
    const updated = await prisma.emailCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    const left = CODE_MAX_ATTEMPTS - updated.attempts;
    return bad(left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Слишком много попыток. Запроси новый код", 401);
  }
  await prisma.emailCode.update({ where: { id: rec.id }, data: { consumedAt: new Date() } });

  const anonId = await getAnonId();
  let user = await prisma.user.findUnique({ where: { email } });
  const isNew = !user;
  if (!user) {
    user = await prisma.user.create({
      data: { email, anonId: anonId === "unknown" ? null : anonId, ipHash: await getIpHash() },
    });
    await prisma.tokenTx.create({
      data: { userId: user.id, amount: getConfig().welcomeBonus, kind: "welcome" },
    });
  }

  // Carry over what the visitor did before signing in.
  if (anonId !== "unknown") {
    const uid = user.id;
    await prisma.swipe.updateMany({ where: { anonId, userId: null }, data: { userId: uid } });
    await prisma.event.updateMany({ where: { anonId, userId: null }, data: { userId: uid } });
    const anonItems = await prisma.setItem.findMany({ where: { anonId, userId: null } });
    for (const item of anonItems) {
      const has = await prisma.setItem.findUnique({ where: { userId_appId: { userId: uid, appId: item.appId } } });
      if (has) await prisma.setItem.delete({ where: { id: item.id } });
      else await prisma.setItem.update({ where: { id: item.id }, data: { userId: uid } });
    }
  }

  await createSession(user.id);
  if (isNew) await logEvent({ userId: user.id, anonId }, "signup_complete", {});
  return NextResponse.json({ isNew, needsInterests: user.interests.length < 3 });
}
