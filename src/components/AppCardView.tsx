"use client";

import type { AppCard } from "@/lib/apps";
import { topicBySlug } from "@/lib/topics";
import { PLATFORM_LABEL, PRICE_LABEL } from "@/lib/client";
import { AppIcon, Tag } from "./ui";
import { IconStar } from "./icons";

/** Product photo or screenshot; without one, the icon on a neutral surface (no neon). */
export function CardImage({ app, className = "", fit = "cover" }: { app: AppCard; className?: string; fit?: "cover" | "contain" }) {
  const src = app.imageUrl || app.screenshots[0];
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className={`h-full w-full object-top ${fit === "cover" ? "object-cover" : "object-contain"}`}
        />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-b from-surface-3 to-surface-1 ${className}`}>
      <AppIcon src={app.iconUrl} name={app.name} size={120} />
    </div>
  );
}

export function topicTags(app: AppCard, max = 2) {
  return app.topics
    .map((t) => topicBySlug(t)?.short)
    .filter(Boolean)
    .slice(0, max) as string[];
}

export function MetaLine({ app }: { app: AppCard }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
      <span>{app.platforms.map((p) => PLATFORM_LABEL[p]).join(" · ")}</span>
      <span aria-hidden>•</span>
      <span>{PRICE_LABEL[app.price]}</span>
      {app.rating ? (
        <>
          <span aria-hidden>•</span>
          <span className="flex items-center gap-1">
            <IconStar className="h-3 w-3 text-white" />
            {app.rating.toFixed(1)}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Feed card: the photo is the hero, text sits on a dark gradient only where it is needed. */
export function AppCardView({ app }: { app: AppCard }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-surface-1 shadow-card">
      <CardImage app={app} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-bg via-bg/85 to-transparent" />
      <div className="absolute left-4 top-4 flex gap-1.5">
        {topicTags(app).map((t) => (
          <Tag key={t} onPhoto>
            AI / {t}
          </Tag>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
        <div className="flex items-center gap-3">
          <AppIcon src={app.iconUrl} name={app.name} size={40} />
          <h2 className="line-clamp-2 font-display text-[28px] font-bold leading-[32px] text-white">{app.name}</h2>
        </div>
        <p className="line-clamp-2 text-[15px] leading-[22px] text-white/90">{app.oneLiner}</p>
        <MetaLine app={app} />
      </div>
    </div>
  );
}
