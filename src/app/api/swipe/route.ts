import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { getConfig, SWIPES_PER_MINUTE } from "@/lib/config";
import { logEvent } from "@/lib/events";

export async function POST(req: Request) {
  const body = await readJson<{ appId?: string; direction?: string; dwellMs?: number }>(req);
  const { appId, direction } = body ?? {};
  if (!appId || (direction !== "right" && direction !== "left")) return bad("Некорректный свайп");
  const id = await getIdentity();
  if (!rateLimit(`swipe:${id.userId ?? id.anonId}`, SWIPES_PER_MINUTE, 60_000)) {
    return bad("Слишком много свайпов, передохни минутку", 429);
  }
  const app = await prisma.app.findFirst({ where: { id: appId, published: true }, select: { id: true } });
  if (!app) return bad("Карточка не найдена", 404);

  const dwellMs = Math.max(0, Math.min(Math.round(Number(body?.dwellMs) || 0), 3_600_000));
  const swipe = await prisma.swipe.create({
    data: { userId: id.userId, anonId: id.anonId, appId, direction, dwellMs },
  });

  let addedToSet = false;
  let survey = false;
  if (direction === "right") {
    const owner = id.userId ? { userId_appId: { userId: id.userId, appId } } : { anonId_appId: { anonId: id.anonId, appId } };
    const existing = await prisma.setItem.findUnique({ where: owner });
    if (!existing) {
      await prisma.setItem.create({
        data: id.userId ? { userId: id.userId, appId } : { anonId: id.anonId, appId },
      });
      addedToSet = true;
    }
    if (id.userId) {
      const likes = await prisma.swipe.count({ where: { userId: id.userId, direction: "right", undone: false } });
      const n = getConfig().surveyEveryNLikes;
      if (n > 0 && likes % n === 0) {
        const done = await prisma.survey.findUnique({ where: { userId_appId: { userId: id.userId, appId } } });
        survey = !done;
        if (survey) await prisma.swipe.update({ where: { id: swipe.id }, data: { surveyOffered: true } });
      }
    }
  }
  await logEvent(id, "swipe", { appId, direction, dwellMs });
  return NextResponse.json({ swipeId: swipe.id, addedToSet, survey });
}
