"use client";

import { useEffect, useRef, useState } from "react";
import type { AppCard } from "@/lib/apps";
import { SURVEY_REASONS } from "@/lib/topics";
import { api, tokensWord } from "@/lib/client";
import { useApp } from "./AppProvider";
import { AppIcon, Button, ErrorText } from "./ui";

const WILL_TRY = [
  { v: "yes", label: "Да" },
  { v: "maybe", label: "Возможно" },
  { v: "no", label: "Нет" },
] as const;

export function SurveyCard({
  app,
  onSubmitted,
  onSkip,
}: {
  app: AppCard;
  onSubmitted: (amount: number) => void;
  onSkip: () => void;
}) {
  const { config } = useApp();
  const started = useRef(Date.now());
  const [usefulness, setUsefulness] = useState(0);
  const [willTry, setWillTry] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = usefulness > 0 && willTry && reasons.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ amount: number }>("/api/survey", {
        method: "POST",
        json: { appId: app.id, usefulness, willTry, reasons, comment, durationMs: Date.now() - started.current },
      });
      onSubmitted(r.amount);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // Controls must not start a card drag. Framer listens natively on the card element,
  // so the stop has to be a native listener on the way up, not a React one.
  const body = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stop = (e: Event) => e.stopPropagation();
    const els = [body.current, foot.current];
    els.forEach((el) => el?.addEventListener("pointerdown", stop));
    return () => els.forEach((el) => el?.removeEventListener("pointerdown", stop));
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-surface-1 shadow-card">
      <div className="flex items-center gap-3 bg-surface-2 p-4">
        <AppIcon src={app.iconUrl} name={app.name} size={40} />
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">
            Опрос · +{config.surveyReward} {tokensWord(config.surveyReward)}
          </div>
          <div className="truncate font-display font-semibold">{app.name}</div>
        </div>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 touch-pan-y overflow-y-auto p-4 text-sm" ref={body}>
        <div>
          <div className="mb-2 font-medium">Насколько это может быть тебе полезно?</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setUsefulness(n)}
                className={`min-h-11 flex-1 rounded-full font-semibold ${usefulness === n ? "bg-lime text-on-lime" : "bg-surface-2 text-white"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 font-medium">Попробуешь в ближайшую неделю?</div>
          <div className="flex gap-2">
            {WILL_TRY.map((o) => (
              <button
                key={o.v}
                onClick={() => setWillTry(o.v)}
                className={`min-h-11 flex-1 rounded-full font-semibold ${willTry === o.v ? "bg-lime text-on-lime" : "bg-surface-2 text-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 font-medium">Почему сохранил?</div>
          <div className="flex flex-wrap gap-2">
            {SURVEY_REASONS.map((r) => {
              const on = reasons.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => setReasons(on ? reasons.filter((x) => x !== r) : [...reasons, r])}
                  className={`min-h-11 rounded-full px-3 ${on ? "bg-lime text-on-lime" : "bg-surface-2 text-white"}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 140))}
            placeholder="Комментарий (необязательно)"
            rows={2}
            aria-label="Комментарий"
            className="w-full resize-none rounded-[14px] bg-surface-2 p-3 text-base text-white ring-1 ring-inset ring-line placeholder:text-subtle focus:ring-white"
          />
          <div className="text-right text-xs text-muted">{comment.length}/140</div>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <div className="flex gap-2 p-4 pt-0" ref={foot}>
        <Button variant="secondary" className="flex-1" onClick={onSkip} disabled={busy}>
          Пропустить опрос
        </Button>
        <Button className="flex-1" onClick={submit} disabled={!ready || busy}>
          Отправить
        </Button>
      </div>
    </div>
  );
}
