import { NextResponse } from "next/server";
import { verifyPendingTokens } from "@/lib/tokens";
import { bad } from "@/lib/http";

// Daily accrual check. Call with `Authorization: Bearer $CRON_SECRET`.
// `?includeToday=1` also processes today's accruals (handy for testing).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return bad("Forbidden", 403);
  const includeToday = new URL(req.url).searchParams.get("includeToday") === "1";
  const result = await verifyPendingTokens({ includeToday });
  return NextResponse.json(result);
}
