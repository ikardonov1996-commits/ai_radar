import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { cleanTopics } from "@/lib/topics";

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return bad("Нужно войти", 401);
  const body = await readJson<{ interests?: unknown }>(req);
  const interests = cleanTopics(body?.interests);
  if (interests.length < 1) return bad("Выбери хотя бы одну тему");
  await prisma.user.update({ where: { id: userId }, data: { interests } });
  return NextResponse.json({ interests });
}
