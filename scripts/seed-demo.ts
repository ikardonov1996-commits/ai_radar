/**
 * Local demo catalog: 36 placeholder cards (3 per topic), published, source = "demo".
 * For trying the app without network access to the stores. Not real products.
 *   npm run seed:demo            # create/refresh
 *   npm run seed:demo -- --clear # delete demo cards
 */
try {
  process.loadEnvFile();
} catch {}

import { prisma } from "../src/lib/db";
import { TOPICS } from "../src/lib/topics";

const PLATFORMS = [["ios", "android"], ["web"], ["ios"], ["android"], ["ios", "android", "web"]] as const;
const PRICES = ["free", "freemium", "paid"] as const;

async function main() {
  if (process.argv.includes("--clear")) {
    const r = await prisma.app.deleteMany({ where: { source: "demo" } });
    console.log(`Deleted ${r.count} demo cards`);
    return;
  }
  let i = 0;
  for (const t of TOPICS) {
    for (let k = 1; k <= 3; k++, i++) {
      const name = `Demo ${t.short} ${k}`;
      const platforms = [...PLATFORMS[i % PLATFORMS.length]];
      const storeUrls = Object.fromEntries(platforms.map((p) => [p, `https://example.com/${p}/${t.slug}-${k}`]));
      const data = {
        name,
        slug: `demo-${t.slug}-${k}`,
        oneLiner: `ДЕМО: помогает с темой «${t.label.toLowerCase()}»`,
        description: `Демонстрационная карточка для локальной проверки ленты. Тема: ${t.label}.\n\nНе настоящий продукт.`,
        platforms,
        price: PRICES[i % PRICES.length],
        rating: k === 3 ? null : 3.8 + ((i * 7) % 12) / 10,
        installs: k === 1 ? "1,000,000+" : null,
        storeUrls,
        topics: [t.slug],
        source: "demo",
        sourceId: `${t.slug}-${k}`,
        published: true,
      };
      await prisma.app.upsert({
        where: { source_sourceId: { source: "demo", sourceId: data.sourceId } },
        create: data,
        update: data,
      });
    }
  }
  console.log(`Demo catalog ready: ${i} cards`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
