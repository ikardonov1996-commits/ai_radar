import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { bad, readJson } from "@/lib/http";
import { EVENT_TYPES, EventType, logEvent } from "@/lib/events";
import { rateLimit } from "@/lib/rateLimit";

// Events the client may report itself; the rest are written by the server.
const CLIENT_EVENTS: EventType[] = [
  "card_view",
  "detail_open",
  "outbound_click",
  "survey_shown",
  "survey_skip",
  "reg_prompt_shown",
  "reg_prompt_accept",
  "reg_prompt_dismiss",
];

export async function POST(req: Request) {
  const body = await readJson<{ type?: string; payload?: Record<string, unknown> }>(req);
  const type = body?.type as EventType | undefined;
  if (!type || !EVENT_TYPES.includes(type) || !CLIENT_EVENTS.includes(type)) return bad("Неизвестное событие");
  const id = await getIdentity();
  if (!rateLimit(`ev:${id.userId ?? id.anonId}`, 300, 60_000)) return bad("Слишком часто", 429);
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  if (JSON.stringify(payload).length > 2000) return bad("Слишком большое событие");
  await logEvent(id, type, payload);
  return NextResponse.json({ ok: true });
}
