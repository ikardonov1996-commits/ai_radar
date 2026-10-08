// Daily accrual check. Railway Cron runs `npm run cron:verify` at 00:00 UTC.
// Pass --include-today to also judge today's accruals (testing only).
try {
  process.loadEnvFile();
} catch {}

import { prisma } from "../src/lib/db";
import { verifyPendingTokens } from "../src/lib/tokens";

async function main() {
  const includeToday = process.argv.includes("--include-today");
  const result = await verifyPendingTokens({ includeToday });
  console.log(JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
