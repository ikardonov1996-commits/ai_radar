import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { toCard } from "@/lib/apps";

export async function GET() {
  const { userId, anonId } = await getIdentity();
  const items = await prisma.setItem.findMany({
    where: userId ? { userId } : { anonId, userId: null },
    include: { app: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    items: items.map((i) => ({ appId: i.appId, status: i.status, createdAt: i.createdAt, app: toCard(i.app) })),
  });
}
