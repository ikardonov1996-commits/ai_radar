import { prisma } from "./db";
import { startOfUtcDay } from "./tokens";

export async function eventStats(from: Date) {
  const where = { createdAt: { gte: from } };
  const [visitors, byType, rights, users] = await Promise.all([
    prisma.event.findMany({ where, distinct: ["anonId"], select: { anonId: true } }),
    prisma.event.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.swipe.groupBy({ by: ["direction"], where: { ...where, undone: false }, _count: { _all: true } }),
    prisma.user.count({ where }),
  ]);
  const count = (t: string) => byType.find((b) => b.type === t)?._count._all ?? 0;
  const right = rights.find((r) => r.direction === "right")?._count._all ?? 0;
  const left = rights.find((r) => r.direction === "left")?._count._all ?? 0;
  return {
    visits: visitors.length,
    swipes: right + left,
    rightShare: right + left ? right / (right + left) : null,
    signups: users,
    surveys: count("survey_submit"),
    outbound: count("outbound_click"),
  };
}

export async function adminSummary() {
  const today = startOfUtcDay();
  const week = new Date(today.getTime() - 6 * 86_400_000);
  const [t, w, published, total] = await Promise.all([
    eventStats(today),
    eventStats(week),
    prisma.app.count({ where: { published: true } }),
    prisma.app.count(),
  ]);
  return { today: t, week: w, published, total };
}
