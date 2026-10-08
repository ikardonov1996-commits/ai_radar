import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFeed } from "@/lib/feed";
import { toCard } from "@/lib/apps";
import { cleanTopics, TOPIC_SLUGS } from "@/lib/topics";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { userId, anonId } = await getIdentity();
  const topicParam = url.searchParams.get("topic") ?? "for-me";
  const topic = TOPIC_SLUGS.includes(topicParam) ? topicParam : "for-me";
  const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean).slice(0, 200);

  let interests: string[];
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { interests: true } });
    interests = user?.interests ?? [];
  } else {
    interests = cleanTopics((url.searchParams.get("interests") ?? "").split(","));
  }

  const { apps, remaining } = await getFeed({ userId, anonId, interests, topic, exclude });
  return NextResponse.json({ apps: apps.map(toCard), remaining });
}
