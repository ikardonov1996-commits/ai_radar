import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { logEvent } from "@/lib/events";

export async function POST(req: Request) {
  const body = await readJson<{ swipeId?: string; removeFromSet?: boolean }>(req);
  if (!body?.swipeId) return bad("Нет свайпа для отмены");
  const id = await getIdentity();
  const swipe = await prisma.swipe.findUnique({ where: { id: body.swipeId } });
  const mine = swipe && (id.userId ? swipe.userId === id.userId : swipe.anonId === id.anonId && !swipe.userId);
  if (!swipe || !mine || swipe.undone) return bad("Нельзя отменить", 404);

  await prisma.swipe.update({ where: { id: swipe.id }, data: { undone: true } });
  // Only remove from the set what this very swipe added.
  if (swipe.direction === "right" && body.removeFromSet) {
    await prisma.setItem.deleteMany({
      where: id.userId ? { userId: id.userId, appId: swipe.appId } : { anonId: id.anonId, userId: null, appId: swipe.appId },
    });
  }
  await logEvent(id, "undo", { appId: swipe.appId, direction: swipe.direction });
  return NextResponse.json({ ok: true });
}
