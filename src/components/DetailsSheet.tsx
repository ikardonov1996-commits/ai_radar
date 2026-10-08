"use client";

import { useEffect, useState } from "react";
import type { AppCard } from "@/lib/apps";
import { topicLabel } from "@/lib/topics";
import { bestLink, PLATFORM_LABEL, track } from "@/lib/client";
import { AppIcon, Button, Sheet, Tag } from "./ui";
import { CardImage, MetaLine, topicTags } from "./AppCardView";
import { IconExternal, IconHeart, IconStar, IconX } from "./icons";

const OPEN_LABEL = { ios: "Открыть в App Store", android: "Открыть в Google Play", web: "Открыть сайт" } as const;

/** Outbound link to the best store / site for this device. Writes `outbound_click`. */
export function OpenLink({ app, className = "", short }: { app: AppCard; className?: string; short?: boolean }) {
  const [link, setLink] = useState<ReturnType<typeof bestLink>>(null);
  useEffect(() => setLink(bestLink(app.storeUrls)), [app]);
  if (!link) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.stopPropagation();
        track("outbound_click", { appId: app.id, target: link.kind });
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform duration-[160ms] active:scale-[0.98] ${className}`}
    >
      {short ? "Открыть" : OPEN_LABEL[link.kind]} <IconExternal className="h-4 w-4" />
    </a>
  );
}

export function DetailsSheet({
  app,
  onClose,
  onSave,
  saved,
}: {
  app: AppCard | null;
  onClose: () => void;
  onSave?: (app: AppCard) => void;
  saved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(false);
    if (app) track("detail_open", { appId: app.id });
  }, [app]);

  const others = app
    ? (Object.entries(app.storeUrls) as [keyof typeof PLATFORM_LABEL, string][]).filter(([, u]) => u)
    : [];

  return (
    <Sheet open={!!app} onClose={onClose} full label={app?.name}>
      {app && (
        <div className="flex min-h-full flex-col">
          <div className="relative">
            <CardImage app={app} className="h-64 w-full" />
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-11 items-center gap-1 rounded-full bg-bg/80 px-4 text-sm font-semibold text-white"
            >
              <IconX className="h-4 w-4" /> Закрыть
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <AppIcon src={app.iconUrl} name={app.name} size={64} />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold leading-7">{app.name}</h2>
                <div className="text-sm text-muted">{app.developer ?? topicLabel(app.topics)}</div>
              </div>
            </div>
            <p className="text-white">{app.oneLiner}</p>
            <div className="flex flex-wrap gap-1.5">
              {topicTags(app, 3).map((t) => (
                <Tag key={t}>AI / {t}</Tag>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              {app.rating ? (
                <span className="flex items-center gap-1">
                  <IconStar className="h-4 w-4 text-white" /> {app.rating.toFixed(1)}
                </span>
              ) : null}
              {app.installs ? <span>{app.installs} загрузок</span> : null}
            </div>
            <MetaLine app={app} />
            {app.description && (
              <div>
                <p className={`whitespace-pre-line text-sm leading-relaxed text-muted ${expanded ? "" : "line-clamp-4"}`}>
                  {app.description}
                </p>
                {!expanded && app.description.length > 220 && (
                  <button onClick={() => setExpanded(true)} className="min-h-11 text-sm font-semibold text-white underline underline-offset-4">
                    Ещё
                  </button>
                )}
              </div>
            )}
            {app.screenshots.length > 0 && (
              <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
                {app.screenshots.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s}
                    src={s}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-72 w-auto shrink-0 rounded-2xl bg-surface-2 object-cover "
                  />
                ))}
              </div>
            )}
            {others.length > 1 && (
              <div className="flex flex-wrap gap-3 text-sm text-muted">
                Также:
                {others.map(([k, u]) => (
                  <a
                    key={k}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-white underline underline-offset-4"
                    onClick={() => track("outbound_click", { appId: app.id, target: k })}
                  >
                    {PLATFORM_LABEL[k]}
                  </a>
                ))}
              </div>
            )}
            <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface-1 pt-2 pb-3">
              {onSave && (
                <Button className="flex items-center justify-center gap-2" onClick={() => onSave(app)} disabled={saved}>
                  <IconHeart className="h-5 w-5" filled={saved} /> {saved ? "В наборе" : "В набор"}
                </Button>
              )}
              <OpenLink app={app} className="bg-surface-2 text-white ring-1 ring-inset ring-outline" />
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
