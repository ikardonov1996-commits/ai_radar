import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { bad, readJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("Forbidden", 403);
  const b = await readJson<{ ids?: string[]; published?: boolean }>(req);
  if (!Array.isArray(b?.ids) || typeof b?.published !== "boolean") return bad("Нужны ids и published");
  const r = await prisma.app.updateMany({ where: { id: { in: b.ids } }, data: { published: b.published } });
  return NextResponse.json({ updated: r.count });
}
