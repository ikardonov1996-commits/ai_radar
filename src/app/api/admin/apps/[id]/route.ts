import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { bad, readJson } from "@/lib/http";
import { cleanTopics } from "@/lib/topics";

type Body = {
  name?: string;
  oneLiner?: string;
  topics?: unknown;
  imageUrl?: string;
  iconUrl?: string;
  storeUrls?: { ios?: string; android?: string; web?: string };
  published?: boolean;
};

const url = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v.trim()) ? v.trim() : undefined);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return bad("Forbidden", 403);
  const { id } = await ctx.params;
  const b = await readJson<Body>(req);
  if (!b) return bad("Пустой запрос");

  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim().slice(0, 120);
  if (typeof b.oneLiner === "string") data.oneLiner = b.oneLiner.trim().slice(0, 70);
  if (b.topics !== undefined) data.topics = cleanTopics(b.topics);
  if (b.imageUrl !== undefined) data.imageUrl = url(b.imageUrl) ?? null;
  if (b.iconUrl !== undefined) data.iconUrl = url(b.iconUrl) ?? null;
  if (b.storeUrls) {
    const s = { ios: url(b.storeUrls.ios), android: url(b.storeUrls.android), web: url(b.storeUrls.web) };
    data.storeUrls = Object.fromEntries(Object.entries(s).filter(([, v]) => v));
    data.platforms = (["ios", "android", "web"] as const).filter((p) => s[p]);
  }
  if (Object.keys(data).length) data.manualEdit = true;
  if (typeof b.published === "boolean") data.published = b.published;

  const app = await prisma.app.update({ where: { id }, data });
  return NextResponse.json({ app });
}
