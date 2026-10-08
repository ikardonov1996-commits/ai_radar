import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { getBalances } from "@/lib/tokens";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, email: user.email, interests: user.interests },
    balances: await getBalances(user.id),
  });
}
