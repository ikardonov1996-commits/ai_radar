import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { bad } from "@/lib/http";
import { getBalances, lastDayResult } from "@/lib/tokens";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return bad("Нужно войти", 401);
  const txs = await prisma.tokenTx.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { survey: { select: { app: { select: { name: true } } } } },
  });
  return NextResponse.json({
    balances: await getBalances(userId),
    lastDay: await lastDayResult(userId),
    history: txs.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      kind: t.kind,
      title: t.kind === "welcome" ? "Бонус за регистрацию" : `Опрос: ${t.survey?.app.name ?? "приложение"}`,
      amount: t.amount,
      status: t.status,
      reason: t.reason,
    })),
  });
}
