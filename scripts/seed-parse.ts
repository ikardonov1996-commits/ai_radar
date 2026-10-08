/**
 * Builds the starting catalog (~100 cards) from App Store, Google Play and a list of web services.
 *
 *   npm run seed:parse                    # everything, 3 apps per topic per store
 *   npm run seed:parse -- --per-topic=4   # more store apps per topic
 *   npm run seed:parse -- --only=web      # one source: ios | android | web
 *   npm run seed:parse -- --dry           # print, do not write
 *   npm run seed:parse -- --regen         # re-generate oneLiner/topics with Claude for existing cards
 *
 * Idempotent: the key is source + sourceId (plus altSourceIds for iOS+Android merged cards).
 * New cards are created with published = false; publish them in /admin.
 */
try {
  process.loadEnvFile();
} catch {}

import { readFileSync } from "fs";
import path from "path";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Prisma, type Price, type Platform } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { TOPICS, TOPIC_SLUGS } from "../src/lib/topics";

const USER_AGENT = "AIRadarBot/0.1 (+catalog seed; contact via site)";
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const PER_TOPIC = Number(args["per-topic"] ?? 3);
const ONLY = args.only ? String(args.only).split(",") : ["ios", "android", "web"];
const DRY = args.dry === "true";
const REGEN = args.regen === "true";

type Raw = {
  source: "appstore" | "googleplay" | "web";
  sourceId: string;
  name: string;
  developer: string | null;
  description: string;
  iconUrl: string | null;
  imageUrl: string | null;
  screenshots: string[];
  rating: number | null;
  installs: string | null;
  price: Price;
  storeUrls: { ios?: string; android?: string; web?: string };
  platforms: Platform[];
  topics: string[];
  altSourceIds: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const politePause = () => sleep(1000 + Math.random() * 1000);

function guessPrice(paid: boolean, text: string, hasIAP?: boolean): Price {
  if (paid) return "paid";
  if (hasIAP || /subscription|subscribe|premium|\bpro\b|in-app|free trial|upgrade/i.test(text)) return "freemium";
  return "free";
}

// ---------- App Store (official iTunes Search API) ----------

type ITunesItem = {
  trackId: number;
  trackName: string;
  artistName?: string;
  sellerName?: string;
  description?: string;
  artworkUrl512?: string;
  artworkUrl100?: string;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
  averageUserRating?: number;
  price?: number;
  trackViewUrl: string;
};

async function fetchAppStore(query: string, limit: number): Promise<ITunesItem[]> {
  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: query,
    entity: "software",
    country: "us",
    limit: String(limit),
  })}`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as { results: ITunesItem[] };
  return data.results ?? [];
}

export function fromITunes(it: ITunesItem, topic: string): Raw {
  const shots = (it.screenshotUrls?.length ? it.screenshotUrls : it.ipadScreenshotUrls ?? []).slice(0, 6);
  const description = it.description ?? "";
  return {
    source: "appstore",
    sourceId: String(it.trackId),
    name: it.trackName,
    developer: it.artistName ?? it.sellerName ?? null,
    description,
    iconUrl: it.artworkUrl512 ?? it.artworkUrl100 ?? null,
    imageUrl: shots[0] ?? null,
    screenshots: shots,
    rating: it.averageUserRating ? Math.round(it.averageUserRating * 10) / 10 : null,
    installs: null,
    price: guessPrice((it.price ?? 0) > 0, description),
    storeUrls: { ios: it.trackViewUrl.split("?")[0] },
    platforms: ["ios"],
    topics: [topic],
    altSourceIds: [],
  };
}

// ---------- Google Play (google-play-scraper) ----------

// google-play-scraper is ESM-only; load it lazily so this CommonJS script can use it.
type GPlay = typeof import("google-play-scraper").default;
let gplayMod: GPlay | null = null;
async function gplayLib(): Promise<GPlay> {
  gplayMod ??= (await import("google-play-scraper")).default;
  return gplayMod;
}

async function fetchGooglePlay(query: string, limit: number) {
  const gplay = await gplayLib();
  const found = await gplay.search({ term: query, num: limit, lang: "en", country: "us" });
  const out = [];
  for (const f of found) {
    try {
      out.push(await gplay.app({ appId: f.appId, lang: "en", country: "us" }));
    } catch (e) {
      console.warn(`  ! play details ${f.appId}: ${(e as Error).message}`);
    }
    await politePause();
  }
  return out;
}

type PlayItem = Awaited<ReturnType<GPlay["app"]>>;

export function fromPlay(it: PlayItem, topic: string): Raw {
  const shots = (it.screenshots ?? []).slice(0, 6);
  return {
    source: "googleplay",
    sourceId: it.appId,
    name: it.title,
    developer: it.developer ?? null,
    description: it.description ?? it.summary ?? "",
    iconUrl: it.icon ?? null,
    imageUrl: it.headerImage || shots[0] || null,
    screenshots: shots,
    rating: it.score ? Math.round(it.score * 10) / 10 : null,
    installs: it.installs ?? null,
    price: guessPrice(!it.free, it.description ?? "", it.offersIAP),
    storeUrls: { android: it.url ?? `https://play.google.com/store/apps/details?id=${it.appId}` },
    platforms: ["android"],
    topics: [topic],
    altSourceIds: [],
  };
}

// ---------- Web services (og: tags, robots.txt respected) ----------

const robotsCache = new Map<string, string[]>();

/** Disallow rules that apply to us (our UA group, else "*"). */
async function disallowRules(origin: string): Promise<string[]> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  let rules: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) rules = parseRobots(await res.text(), "airadarbot");
  } catch {
    /* no robots.txt reachable: nothing disallowed */
  }
  robotsCache.set(origin, rules);
  return rules;
}

export function parseRobots(txt: string, agent: string): string[] {
  const groups: { agents: string[]; disallow: string[]; allowAll: boolean }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], disallow: [], allowAll: false };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && key === "disallow" && val) cur.disallow.push(val);
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.disallow);
}

export function isAllowed(pathname: string, rules: string[]) {
  return !rules.some((r) => {
    const re = new RegExp("^" + r.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return re.test(pathname);
  });
}

function abs(base: string, href: string | undefined | null) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function parseWebPage(html: string, url: string, topics: string[]): Raw {
  const $ = cheerio.load(html);
  const meta = (sel: string) => $(sel).attr("content")?.trim() || null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  const title = meta('meta[property="og:title"]') ?? ($("title").first().text().trim() || host);
  const siteName = meta('meta[property="og:site_name"]');
  const name = (siteName ?? title.split(/\s[|\-–—:·]\s/)[0]).trim().slice(0, 60) || host;
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]') ?? "";
  const image = abs(url, meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]'));
  const icon =
    abs(url, $('link[rel="apple-touch-icon"]').attr("href")) ??
    abs(url, $('link[rel~="icon"]').last().attr("href")) ??
    abs(url, "/favicon.ico");
  return {
    source: "web",
    sourceId: host + new URL(url).pathname.replace(/\/$/, ""),
    name,
    developer: null,
    description,
    iconUrl: icon,
    imageUrl: image,
    screenshots: image ? [image] : [],
    rating: null,
    installs: null,
    price: guessPrice(false, description + " pricing"),
    storeUrls: { web: url },
    platforms: ["web"],
    topics,
    altSourceIds: [],
  };
}

async function fetchWeb(entry: { url: string; topics: string[] }): Promise<Raw | null> {
  const u = new URL(entry.url);
  const rules = await disallowRules(u.origin);
  if (!isAllowed(u.pathname, rules)) {
    console.warn(`  ! robots.txt disallows ${entry.url}, skipped`);
    return null;
  }
  await politePause();
  const res = await fetch(entry.url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseWebPage(await res.text(), entry.url, entry.topics);
}

// ---------- iOS + Android dedup ----------

export function nameKey(name: string) {
  return name
    .toLowerCase()
    .split(/\s[:\-–—|(]\s?|:\s|\s\(|,\s/)[0]
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
export function devKey(dev: string | null) {
  return (dev ?? "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|corp|corporation|co|limited|technologies|labs?|pte|s\.?a\.?)\b\.?/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
const sameDev = (a: string | null, b: string | null) => {
  const x = devKey(a);
  const y = devKey(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export function mergeStores(ios: Raw[], android: Raw[]): Raw[] {
  const out: Raw[] = [...ios];
  for (const a of android) {
    const twin = out.find((i) => i.source === "appstore" && nameKey(i.name) === nameKey(a.name) && sameDev(i.developer, a.developer));
    if (!twin) {
      out.push(a);
      continue;
    }
    twin.storeUrls.android = a.storeUrls.android;
    twin.platforms = [...new Set([...twin.platforms, "android" as const])];
    twin.topics = [...new Set([...twin.topics, ...a.topics])];
    twin.altSourceIds.push(`googleplay:${a.sourceId}`);
    twin.installs = twin.installs ?? a.installs;
    if (twin.screenshots.length === 0) twin.screenshots = a.screenshots;
    twin.imageUrl = twin.imageUrl ?? a.imageUrl;
  }
  return out;
}

// ---------- oneLiner + topics ----------

export function fallbackOneLiner(description: string) {
  const first = description.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return first.length <= 70 ? first : first.slice(0, 69).replace(/\s+\S*$/, "") + "…";
}

const Describe = z.object({
  oneLiner: z.string(),
  topics: z.array(z.enum(TOPIC_SLUGS as [string, ...string[]])),
});

let anthropic: Anthropic | null = null;

async function describe(raw: Raw): Promise<{ oneLiner: string; topics: string[] }> {
  const fallback = { oneLiner: fallbackOneLiner(raw.description) || raw.name, topics: raw.topics };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  anthropic ??= new Anthropic();
  const topicList = TOPICS.map((t) => `${t.slug}: ${t.label}`).join("\n");
  try {
    const res = await anthropic.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(Describe) },
      messages: [
        {
          role: "user",
          content: `Ты редактор каталога AI-приложений. По описанию ниже:
1. Напиши oneLiner — одну строку по-русски, до 70 символов, о том, что приложение делает для человека. Без названия приложения, без кавычек, без слов «лучший», «революционный».
2. Выбери от 1 до 3 тем из списка (верни slug):
${topicList}

Название: ${raw.name}
Описание: ${raw.description.slice(0, 3000)}`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return fallback;
    const { oneLiner, topics } = res.parsed_output;
    const line = oneLiner.trim().replace(/^["«]|["»]$/g, "");
    return {
      oneLiner: line.length <= 70 ? line : line.slice(0, 69).replace(/\s+\S*$/, "") + "…",
      topics: topics.length ? [...new Set(topics)] : raw.topics,
    };
  } catch (e) {
    console.warn(`  ! Claude failed for ${raw.name}: ${(e as Error).message}`);
    return fallback;
  }
}

// ---------- upsert ----------

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 50) || "app"
  );
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await prisma.app.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function upsert(raw: Raw): Promise<"created" | "updated"> {
  const keys = [`${raw.source}:${raw.sourceId}`, ...raw.altSourceIds];
  const existing = await prisma.app.findFirst({
    where: { OR: [{ source: raw.source, sourceId: raw.sourceId }, { altSourceIds: { hasSome: keys } }] },
  });
  const fresh = {
    developer: raw.developer,
    description: raw.description,
    screenshots: raw.screenshots,
    rating: raw.rating,
    installs: raw.installs,
    price: raw.price,
  };

  if (existing) {
    const needText = REGEN || !existing.oneLiner;
    const text = needText && !existing.manualEdit ? await describe(raw) : null;
    const urls = { ...(existing.storeUrls as object), ...raw.storeUrls };
    await prisma.app.update({
      where: { id: existing.id },
      data: {
        ...fresh,
        altSourceIds: [...new Set([...existing.altSourceIds, ...raw.altSourceIds])],
        ...(existing.manualEdit
          ? {}
          : {
              name: raw.name,
              iconUrl: raw.iconUrl,
              imageUrl: raw.imageUrl,
              storeUrls: urls as Prisma.InputJsonValue,
              platforms: [...new Set([...existing.platforms, ...raw.platforms])],
              ...(text ? { oneLiner: text.oneLiner, topics: text.topics } : {}),
            }),
      },
    });
    return "updated";
  }

  const text = await describe(raw);
  await prisma.app.create({
    data: {
      ...fresh,
      slug: await uniqueSlug(slugify(raw.name)),
      name: raw.name,
      oneLiner: text.oneLiner,
      topics: text.topics,
      iconUrl: raw.iconUrl,
      imageUrl: raw.imageUrl,
      platforms: raw.platforms,
      storeUrls: raw.storeUrls as Prisma.InputJsonValue,
      source: raw.source,
      sourceId: raw.sourceId,
      altSourceIds: raw.altSourceIds,
      published: false,
    },
  });
  return "created";
}

// ---------- main ----------

async function main() {
  console.log(`Seed: per topic ${PER_TOPIC}, sources ${ONLY.join(", ")}${DRY ? " (dry run)" : ""}`);
  console.log(process.env.ANTHROPIC_API_KEY ? "oneLiner: Claude" : "oneLiner: first sentence (no ANTHROPIC_API_KEY)");

  const ios: Raw[] = [];
  const android: Raw[] = [];
  const seenIds = new Set<string>();

  for (const t of TOPICS) {
    if (ONLY.includes("ios")) {
      try {
        const found = await fetchAppStore(t.query, PER_TOPIC * 4);
        let taken = 0;
        for (const it of found) {
          if (taken >= PER_TOPIC) break;
          const key = `ios:${it.trackId}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          ios.push(fromITunes(it, t.slug));
          taken++;
        }
        console.log(`  App Store  ${t.slug}: ${taken}`);
      } catch (e) {
        console.warn(`  ! App Store ${t.slug}: ${(e as Error).message}`);
      }
      await politePause();
    }
    if (ONLY.includes("android")) {
      try {
        const found = await fetchGooglePlay(t.query, PER_TOPIC * 2);
        let taken = 0;
        for (const it of found) {
          if (taken >= PER_TOPIC) break;
          const key = `android:${it.appId}`;
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          android.push(fromPlay(it, t.slug));
          taken++;
        }
        console.log(`  Google Play ${t.slug}: ${taken}`);
      } catch (e) {
        console.warn(`  ! Google Play ${t.slug}: ${(e as Error).message}`);
      }
    }
  }

  const web: Raw[] = [];
  if (ONLY.includes("web")) {
    const list = JSON.parse(readFileSync(path.join(__dirname, "../seed/web-sources.json"), "utf8")) as {
      url: string;
      topics: string[];
    }[];
    for (const entry of list) {
      try {
        const r = await fetchWeb(entry);
        if (r) web.push(r);
        console.log(`  Web ${entry.url}: ${r ? "ok" : "skipped"}`);
      } catch (e) {
        console.warn(`  ! Web ${entry.url}: ${(e as Error).message}`);
      }
    }
  }

  const all = [...mergeStores(ios, android), ...web];
  console.log(`\nCollected ${all.length} cards (iOS ${ios.length}, Android ${android.length}, web ${web.length}).`);

  if (DRY) {
    for (const r of all) console.log(`- [${r.platforms.join("+")}] ${r.name} — ${fallbackOneLiner(r.description)}`);
    return;
  }

  const counts = { created: 0, updated: 0 };
  for (const r of all) {
    try {
      counts[await upsert(r)]++;
    } catch (e) {
      console.warn(`  ! save ${r.name}: ${(e as Error).message}`);
    }
  }
  console.log(`Saved: ${counts.created} new, ${counts.updated} updated.`);

  // Balance report over the whole catalog.
  const apps = await prisma.app.findMany({ select: { topics: true, platforms: true } });
  const perTopic = TOPICS.map((t) => [t.slug, apps.filter((a) => a.topics.includes(t.slug)).length] as const);
  console.log("\nCards per topic:");
  for (const [slug, n] of perTopic) console.log(`  ${slug.padEnd(13)} ${n}${n < 5 ? "  <- fewer than 5" : ""}`);
  for (const p of ["ios", "android", "web"] as const) {
    console.log(`  platform ${p.padEnd(8)} ${apps.filter((a) => a.platforms.includes(p)).length}`);
  }
  console.log("\nAll new cards are unpublished. Review and publish them in /admin.");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
