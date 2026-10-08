import type { Survey, TokenTx, User } from "@prisma/client";
import { prisma } from "./db";
import {
  getConfig,
  MAX_ACCOUNTS_PER_DEVICE_PER_DAY,
  SURVEY_MIN_DURATION_MS,
  TEMPLATE_RUN_LENGTH,
} from "./config";

export const REASONS = {
  tooFast: "Опрос заполнен быстрее 4 секунд",
  template: `Одинаковые ответы в ${TEMPLATE_RUN_LENGTH} опросах подряд`,
  copyPaste: "Такой же комментарий есть у другого аккаунта",
  dailyCap: "Превышен дневной лимит начислений",
  multiAccount: "Слишком много аккаунтов с одного устройства или сети",
} as const;

export async function getBalances(userId: string) {
  const groups = await prisma.tokenTx.groupBy({
    by: ["status"],
    where: { userId },
    _sum: { amount: true },
  });
  const sum = (s: string) => groups.find((g) => g.status === s)?._sum.amount ?? 0;
  return { confirmed: sum("confirmed"), pending: sum("pending") };
}

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function answerKey(s: Survey) {
  return `${s.usefulness}|${s.willTry}|${[...s.reasons].sort().join(",")}`;
}

export function normalizeComment(c: string | null | undefined) {
  return (c ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
/** Short comments ("ок", "круто") repeat naturally; only longer ones count as copy-paste. */
const COPY_PASTE_MIN_LENGTH = 12;

/** Survey ids that sit inside a run of >= N identical consecutive answers of one user. */
function templateSurveyIds(surveys: Survey[]): Set<string> {
  const out = new Set<string>();
  const byUser = new Map<string, Survey[]>();
  for (const s of surveys) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  for (const list of byUser.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let start = 0;
    for (let i = 1; i <= list.length; i++) {
      if (i < list.length && answerKey(list[i]) === answerKey(list[start])) continue;
      if (i - start >= TEMPLATE_RUN_LENGTH) for (let j = start; j < i; j++) out.add(list[j].id);
      start = i;
    }
  }
  return out;
}

/** Users that are the (N+1)-th or later account created within 24h on one anonId or IP hash. */
function multiAccountUserIds(users: Pick<User, "id" | "anonId" | "ipHash" | "createdAt">[]): Set<string> {
  const out = new Set<string>();
  const sorted = [...users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const u of sorted) {
    const peers = sorted.filter(
      (p) =>
        p.createdAt.getTime() < u.createdAt.getTime() &&
        u.createdAt.getTime() - p.createdAt.getTime() < DAY &&
        ((u.anonId && p.anonId === u.anonId) || (u.ipHash && p.ipHash === u.ipHash)),
    );
    if (peers.length >= MAX_ACCOUNTS_PER_DEVICE_PER_DAY) out.add(u.id);
  }
  return out;
}

export type VerifyResult = { processed: number; confirmed: number; rejected: number; byReason: Record<string, number> };

/**
 * Daily check of pending accruals. By default only takes accruals created before the
 * start of the current UTC day, so each day is judged with its full picture (daily cap).
 */
export async function verifyPendingTokens(opts: { includeToday?: boolean; now?: Date } = {}): Promise<VerifyResult> {
  const now = opts.now ?? new Date();
  const cutoff = opts.includeToday ? now : startOfUtcDay(now);
  const { dailyCap } = getConfig();

  const pending = await prisma.tokenTx.findMany({
    where: { status: "pending", createdAt: { lt: cutoff } },
    include: { survey: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  const result: VerifyResult = { processed: 0, confirmed: 0, rejected: 0, byReason: {} };
  if (pending.length === 0) return result;

  const userIds = [...new Set(pending.map((t) => t.userId))];

  // Template answers: look at all surveys of the affected users.
  const userSurveys = await prisma.survey.findMany({ where: { userId: { in: userIds } } });
  const templates = templateSurveyIds(userSurveys);

  // Copy-paste comments across different accounts.
  const commented = await prisma.survey.findMany({
    where: { comment: { not: null } },
    select: { userId: true, comment: true },
  });
  const authorsByComment = new Map<string, Set<string>>();
  for (const s of commented) {
    const n = normalizeComment(s.comment);
    if (n.length < COPY_PASTE_MIN_LENGTH) continue;
    authorsByComment.set(n, (authorsByComment.get(n) ?? new Set()).add(s.userId));
  }

  // Multi-accounting for welcome bonuses.
  const welcomeUsers = pending.filter((t) => t.kind === "welcome").map((t) => t.user);
  let multi = new Set<string>();
  if (welcomeUsers.length) {
    const minDate = new Date(Math.min(...welcomeUsers.map((u) => u.createdAt.getTime())) - DAY);
    const anonIds = welcomeUsers.map((u) => u.anonId).filter((x): x is string => !!x);
    const ipHashes = welcomeUsers.map((u) => u.ipHash).filter((x): x is string => !!x);
    const related = await prisma.user.findMany({
      where: {
        createdAt: { gte: minDate },
        OR: [{ anonId: { in: anonIds } }, { ipHash: { in: ipHashes } }],
      },
      select: { id: true, anonId: true, ipHash: true, createdAt: true },
    });
    multi = multiAccountUserIds(related);
  }

  // Daily cap (survey rewards only): start from what is already confirmed that day.
  const days = [...new Set(pending.map((t) => dayKey(t.createdAt)))];
  const confirmedSoFar = new Map<string, number>(); // `${userId}|${day}` -> sum
  for (const day of days) {
    const from = new Date(`${day}T00:00:00.000Z`);
    const rows = await prisma.tokenTx.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        kind: "survey",
        status: "confirmed",
        createdAt: { gte: from, lt: new Date(from.getTime() + DAY) },
      },
      _sum: { amount: true },
    });
    for (const r of rows) confirmedSoFar.set(`${r.userId}|${day}`, r._sum.amount ?? 0);
  }

  const decide = (t: TokenTx & { survey: Survey | null }): string | null => {
    if (t.kind === "welcome") return multi.has(t.userId) ? REASONS.multiAccount : null;
    const s = t.survey;
    if (s) {
      if (s.durationMs < SURVEY_MIN_DURATION_MS) return REASONS.tooFast;
      if (templates.has(s.id)) return REASONS.template;
      const n = normalizeComment(s.comment);
      if (n.length >= COPY_PASTE_MIN_LENGTH && (authorsByComment.get(n)?.size ?? 0) > 1) return REASONS.copyPaste;
    }
    const key = `${t.userId}|${dayKey(t.createdAt)}`;
    const used = confirmedSoFar.get(key) ?? 0;
    if (used + t.amount > dailyCap) return REASONS.dailyCap;
    confirmedSoFar.set(key, used + t.amount);
    return null;
  };

  for (const t of pending) {
    const reason = decide(t);
    const status = reason ? "rejected" : "confirmed";
    await prisma.$transaction([
      prisma.tokenTx.update({ where: { id: t.id }, data: { status, reason, decidedAt: now } }),
      ...(t.surveyId ? [prisma.survey.update({ where: { id: t.surveyId }, data: { status } })] : []),
    ]);
    result.processed++;
    if (reason) {
      result.rejected++;
      result.byReason[reason] = (result.byReason[reason] ?? 0) + 1;
    } else result.confirmed++;
  }
  return result;
}

/** What the last daily check decided for this user: totals and rejection reasons. */
export async function lastDayResult(userId: string) {
  const last = await prisma.tokenTx.findFirst({
    where: { userId, decidedAt: { not: null } },
    orderBy: { decidedAt: "desc" },
    select: { decidedAt: true },
  });
  if (!last?.decidedAt) return null;
  const from = startOfUtcDay(last.decidedAt);
  const txs = await prisma.tokenTx.findMany({
    where: { userId, decidedAt: { gte: from, lt: new Date(from.getTime() + DAY) } },
  });
  const confirmed = txs.filter((t) => t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const rejected = txs.filter((t) => t.status === "rejected");
  const reasons: Record<string, number> = {};
  for (const t of rejected) reasons[t.reason ?? "—"] = (reasons[t.reason ?? "—"] ?? 0) + t.amount;
  return {
    date: from.toISOString(),
    confirmed,
    rejected: rejected.reduce((s, t) => s + t.amount, 0),
    reasons: Object.entries(reasons).map(([reason, amount]) => ({ reason, amount })),
  };
}
