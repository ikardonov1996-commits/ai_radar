import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnonId, getUserId } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { getConfig } from "@/lib/config";
import { SURVEY_REASONS } from "@/lib/topics";
import { logEvent } from "@/lib/events";

type Body = {
  appId?: string;
  usefulness?: number;
  willTry?: string;
  reasons?: unknown;
  comment?: string;
  durationMs?: number;
};

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return bad("Опросы доступны после регистрации", 401);
  const b = await readJson<Body>(req);
  if (!b?.appId) return bad("Нет приложения");
  const usefulness = Math.round(Number(b.usefulness));
  if (!(usefulness >= 1 && usefulness <= 5)) return bad("Оцени полезность от 1 до 5");
  if (b.willTry !== "yes" && b.willTry !== "maybe" && b.willTry !== "no") return bad("Ответь, попробуешь ли");
  const reasons = Array.isArray(b.reasons)
    ? [...new Set(b.reasons.filter((r): r is string => (SURVEY_REASONS as readonly string[]).includes(r as string)))]
    : [];
  if (reasons.length === 0) return bad("Выбери хотя бы одну причину");
  const comment = (b.comment ?? "").trim().slice(0, 140) || null;
  const durationMs = Math.max(0, Math.round(Number(b.durationMs) || 0));

  // A survey is only valid where one was offered: the N-th like, not undone.
  const liked = await prisma.swipe.findFirst({
    where: { userId, appId: b.appId, direction: "right", undone: false, surveyOffered: true },
  });
  if (!liked) return bad("Опрос недоступен", 403);
  const existing = await prisma.survey.findUnique({ where: { userId_appId: { userId, appId: b.appId } } });
  if (existing) return bad("Опрос уже пройден", 409);

  const amount = getConfig().surveyReward;
  const survey = await prisma.survey.create({
    data: { userId, appId: b.appId, usefulness, willTry: b.willTry, reasons, comment, durationMs },
  });
  await prisma.tokenTx.create({ data: { userId, amount, kind: "survey", surveyId: survey.id } });
  await logEvent({ userId, anonId: await getAnonId() }, "survey_submit", { appId: b.appId, durationMs });
  return NextResponse.json({ ok: true, amount });
}
