import { prisma } from "./db";
import { FEED_BATCH, getConfig } from "./config";

type Candidate = { id: string; topics: string[]; createdAt: Date };

const FRESHNESS_HALF_LIFE_DAYS = 14;

/** Freshness weight: a card loses half its pull every two weeks, never below 0.15. */
function weight(c: Candidate, now: number) {
  const ageDays = Math.max(0, (now - c.createdAt.getTime()) / 86_400_000);
  return 0.15 + Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS);
}

/** Weighted random order (Efraimidis–Spirakis): key = u^(1/w), larger first. */
export function weightedShuffle<T extends Candidate>(items: T[], now = Date.now()): T[] {
  return items
    .map((c) => ({ c, k: Math.pow(Math.random(), 1 / weight(c, now)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.c);
}

/**
 * Picks the next batch of card ids.
 * - topic = a single slug: only that topic.
 * - topic = "for-me": (1 - share) from interests, share from other topics.
 * - no interests: a mix of everything.
 */
export function pickBatch(
  candidates: Candidate[],
  interests: string[],
  topic: string,
  neutralShare: number,
  size = FEED_BATCH,
): string[] {
  if (topic !== "for-me") {
    return weightedShuffle(candidates.filter((c) => c.topics.includes(topic)))
      .slice(0, size)
      .map((c) => c.id);
  }
  if (interests.length === 0) {
    return weightedShuffle(candidates).slice(0, size).map((c) => c.id);
  }
  const isMine = (c: Candidate) => c.topics.some((t) => interests.includes(t));
  const mine = weightedShuffle(candidates.filter(isMine));
  const other = weightedShuffle(candidates.filter((c) => !isMine(c)));

  const total = Math.min(size, mine.length + other.length);
  let neutral = Math.round(total * neutralShare);
  neutral = Math.min(neutral, other.length);
  let own = Math.min(total - neutral, mine.length);
  neutral = Math.min(other.length, total - own); // fill with the other pool if one runs dry
  own = Math.min(mine.length, total - neutral);

  // Spread neutral slots randomly through the batch.
  const slots: boolean[] = [...Array(own).fill(false), ...Array(neutral).fill(true)];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  let mi = 0;
  let oi = 0;
  return slots.map((isNeutral) => (isNeutral ? other[oi++] : mine[mi++]).id);
}

export async function getFeed(opts: {
  userId: string | null;
  anonId: string;
  interests: string[];
  topic: string;
  exclude: string[];
}) {
  const swiped = await prisma.swipe.findMany({
    where: opts.userId ? { userId: opts.userId, undone: false } : { anonId: opts.anonId, undone: false },
    select: { appId: true },
  });
  const skip = new Set([...swiped.map((s) => s.appId), ...opts.exclude]);
  const all = await prisma.app.findMany({
    where: { published: true },
    select: { id: true, topics: true, createdAt: true },
  });
  const candidates = all.filter((a) => !skip.has(a.id));
  const ids = pickBatch(candidates, opts.interests, opts.topic, getConfig().neutralSlotShare);
  const rows = await prisma.app.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    apps: ids.map((id) => byId.get(id)!).filter(Boolean),
    remaining: candidates.length - ids.length,
  };
}
