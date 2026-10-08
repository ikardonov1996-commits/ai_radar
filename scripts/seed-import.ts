/**
 * Loads the curated catalog from seed/catalog.json. Runs on every start (see package.json "start").
 *
 *   npm run seed:import
 *
 * Only creates cards that are not in the database yet (matched by source + sourceId or altSourceIds),
 * published. Existing cards are never touched, so edits and unpublishing in /admin stick.
 * Rebuild the file with `npm run seed:parse` + review, then commit it.
 */
import { readFileSync } from "fs";
import path from "path";
import { Prisma, type Platform, type Price } from "@prisma/client";
import { prisma } from "../src/lib/db";

type Card = {
  slug: string;
  name: string;
  developer: string | null;
  oneLiner: string;
  description: string;
  iconUrl: string | null;
  imageUrl: string | null;
  screenshots: string[];
  platforms: Platform[];
  price: Price;
  rating: number | null;
  installs: string | null;
  storeUrls: Record<string, string>;
  topics: string[];
  source: string;
  sourceId: string;
  altSourceIds: string[];
};

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await prisma.app.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function main() {
  const cards = JSON.parse(readFileSync(path.join(__dirname, "../seed/catalog.json"), "utf8")) as Card[];
  let created = 0;
  for (const c of cards) {
    const keys = [`${c.source}:${c.sourceId}`, ...c.altSourceIds];
    const exists = await prisma.app.findFirst({
      where: {
        OR: [
          { source: c.source, sourceId: c.sourceId },
          { altSourceIds: { hasSome: keys } },
          ...keys.map((k) => {
            const i = k.indexOf(":");
            return { source: k.slice(0, i), sourceId: k.slice(i + 1) };
          }),
        ],
      },
      select: { id: true },
    });
    if (exists) continue;
    const { slug, storeUrls, ...rest } = c;
    await prisma.app.create({
      data: { ...rest, slug: await uniqueSlug(slug), storeUrls: storeUrls as Prisma.InputJsonValue, published: true },
    });
    created++;
  }
  console.log(`Catalog: ${created} new cards, ${cards.length - created} already present.`);
}

main()
  .catch((e) => {
    // Never block the app from starting because of the catalog.
    console.error("Catalog import failed:", e);
  })
  .finally(() => prisma.$disconnect());
