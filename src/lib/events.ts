import { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const EVENT_TYPES = [
  "card_view",
  "swipe",
  "undo",
  "detail_open",
  "outbound_click",
  "survey_shown",
  "survey_submit",
  "survey_skip",
  "reg_prompt_shown",
  "reg_prompt_accept",
  "reg_prompt_dismiss",
  "signup_complete",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export async function logEvent(
  identity: { userId: string | null; anonId: string },
  type: EventType,
  payload: Record<string, unknown> = {},
) {
  await prisma.event.create({
    data: {
      userId: identity.userId,
      anonId: identity.anonId,
      type,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
