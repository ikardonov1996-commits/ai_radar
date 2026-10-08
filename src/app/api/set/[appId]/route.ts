import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { bad, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ appId: string }> };

async function ownerWhere(appId: string) {
  const { userId, anonId } = await getIdentity();
  return userId ? { userId, appId } : { anonId, userId: null, appId };
}

/** Add to set (from the details screen) or change status want/using. */
export async function PUT(req: Request, ctx: Ctx) {
  const { appId } = await ctx.params;
  const body = await readJson<{ status?: string }>(req);
  const status = body?.status === "using" ? "using" : "want";
  const where = await ownerWhere(appId);
  const updated = await prisma.setItem.updateMany({ where, data: { status } });
  if (updated.count === 0) {
    const app = await prisma.app.findFirst({ where: { id: appId, published: true }, select: { id: true } });
    if (!app) return bad("Карточка не найдена", 404);
    const { userId, anonId } = await getIdentity();
    await prisma.setItem.create({ data: userId ? { userId, appId, status } : { anonId, appId, status } });
  }
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { appId } = await ctx.params;
  await prisma.setItem.deleteMany({ where: await ownerWhere(appId) });
  return NextResponse.json({ ok: true });
}
