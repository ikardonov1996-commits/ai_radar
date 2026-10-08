import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { bad } from "@/lib/http";

export async function GET(req: Request) {
  if (!(await isAdmin())) return bad("Forbidden", 403);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const q = url.searchParams.get("q")?.trim();
  const apps = await prisma.app.findMany({
    where: {
      ...(status === "published" ? { published: true } : status === "draft" ? { published: false } : {}),
      ...(source ? { source } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ published: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ apps });
}
