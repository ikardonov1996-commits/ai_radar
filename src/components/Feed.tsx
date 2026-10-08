"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppCard } from "@/lib/apps";
import { topicBySlug } from "@/lib/topics";
import { api, ssGet, ssSet, tokensWord, track } from "@/lib/client";
import { REG_PROMPT_MAX_PER_SESSION, REG_PROMPT_REPEAT_EVERY } from "@/lib/config";
import { useApp } from "./AppProvider";
import { Dir, SwipeCard, SwipeCardHandle } from "./SwipeCard";
import { AppCardView } from "./AppCardView";
import { SurveyCard } from "./SurveyCard";
import { DetailsSheet } from "./DetailsSheet";
import { InterestsGrid } from "./InterestsGrid";
import { Button, Chip, Logo, Sheet, Toast } from "./ui";
import { IconGift, IconHeart, IconSettings, IconUndo, IconX } from "./icons";

type DeckItem = { kind: "app"; key: string; app: AppCard; enterFrom?: Dir } | { kind: "survey"; key: string; app: AppCard };

type LastSwipe = {
  app: AppCard;
  dir: Dir;
  result: Promise<{ swipeId: string; addedToSet: boolean } | null>;
};

const REG_STATE = "ar_reg_prompt";
type RegState = { swipes: number; shown: number; lastAt: number };

const preloaded = new Set<string>();
function preload(app: AppCard) {
  const src = app.imageUrl || app.screenshots[0];
  for (const s of [src, app.iconUrl]) {
    if (s && !preloaded.has(s)) {
      preloaded.add(s);
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = s;
    }
  }
}

export function Feed() {
  const router = useRouter();
  const { user, config, interests, setInterests, refreshUser } = useApp();
  const [topic, setTopic] = useState("for-me");
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [last, setLast] = useState<LastSwipe | null>(null);
  const [details, setDetails] = useState<AppCard | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const topRef = useRef<SwipeCardHandle>(null);
  const seen = useRef<Set<string>>(new Set());
  const shownAt = useRef(Date.now());
  const fetching = useRef(false);
  const surveySubmitted = useRef(false);
  const generation = useRef(0);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 2600);
  }, []);

  const interestsKey = interests.join(",");

  const loadMore = useCallback(
    async (reset = false) => {
      if (fetching.current && !reset) return;
      fetching.current = true;
      const gen = reset ? ++generation.current : generation.current;
      if (reset) {
        setDeck([]);
        setExhausted(false);
        setLoading(true);
      }
      try {
        const current = reset ? [] : deckRef.current.map((d) => d.app.id);
        const exclude = [...new Set([...current, ...seen.current])].slice(-200);
        const qs = new URLSearchParams({ topic, exclude: exclude.join(",") });
        if (!user && interestsKey) qs.set("interests", interestsKey);
        const r = await api<{ apps: AppCard[] }>(`/api/feed?${qs}`);
        if (gen !== generation.current) return;
        setDeck((d) => {
          const have = new Set(d.map((x) => x.app.id));
          return [...d, ...r.apps.filter((a) => !have.has(a.id)).map((app) => ({ kind: "app" as const, key: app.id, app }))];
        });
        if (r.apps.length === 0) setExhausted(true);
      } catch (e) {
        showToast((e as Error).message);
      } finally {
        if (gen === generation.current) {
          fetching.current = false;
          setLoading(false);
        }
      }
    },
    [topic, user, interestsKey, showToast],
  );

  const deckRef = useRef(deck);
  deckRef.current = deck;

  // Reload when topic or interests change.
  useEffect(() => {
    setLast(null);
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, interestsKey, user?.id]);

  // Keep the deck topped up, preload the next three images.
  useEffect(() => {
    deck.slice(0, 4).forEach((d) => preload(d.app));
    if (!loading && !exhausted && deck.filter((d) => d.kind === "app").length < 6) loadMore();
  }, [deck, loading, exhausted, loadMore]);

  // card_view when a new app comes to the top.
  const top = deck[0];
  useEffect(() => {
    if (!top) return;
    shownAt.current = Date.now();
    if (top.kind === "app") track("card_view", { appId: top.app.id, topic });
    else track("survey_shown", { appId: top.app.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.key]);

  const maybePromptRegistration = () => {
    if (user) return;
    const s = ssGet<RegState>(REG_STATE, { swipes: 0, shown: 0, lastAt: 0 });
    s.swipes++;
    const due =
      s.swipes >= config.regPromptAfterSwipes &&
      s.shown < REG_PROMPT_MAX_PER_SESSION &&
      (s.shown === 0 || s.swipes - s.lastAt >= REG_PROMPT_REPEAT_EVERY);
    if (due) {
      s.shown++;
      s.lastAt = s.swipes;
      setRegOpen(true);
      track("reg_prompt_shown", { swipes: s.swipes });
    }
    ssSet(REG_STATE, s);
  };

  const onSwiped = (item: DeckItem, dir: Dir) => {
    setBusy(false);
    setDeck((d) => d.filter((x) => x.key !== item.key));
    if (item.kind === "survey") {
      if (!surveySubmitted.current) track("survey_skip", { appId: item.app.id });
      surveySubmitted.current = false;
      setLast(null);
      return;
    }
    const app = item.app;
    seen.current.add(app.id);
    const dwellMs = Date.now() - shownAt.current;
    const result = api<{ swipeId: string; addedToSet: boolean; survey: boolean }>("/api/swipe", {
      method: "POST",
      json: { appId: app.id, direction: dir, dwellMs },
    })
      .then((r) => {
        if (r.survey) {
          setDeck((d) => [{ kind: "survey", key: `survey-${app.id}`, app }, ...d]);
        }
        return r;
      })
      .catch((e: Error) => {
        // Rejected (e.g. rate limit): put the card back.
        showToast(e.message);
        seen.current.delete(app.id);
        setDeck((d) => [{ kind: "app", key: `${app.id}-${Date.now()}`, app }, ...d]);
        setLast(null);
        return null;
      });
    setLast({ app, dir, result });
    maybePromptRegistration();
  };

  const swipeTop = (dir: Dir) => {
    if (!top || busy) return;
    setBusy(true);
    topRef.current?.swipe(dir);
  };

  const undo = async () => {
    if (!last || busy) return;
    const { app, dir, result } = last;
    setLast(null);
    seen.current.delete(app.id);
    setDeck((d) => [
      { kind: "app", key: `${app.id}-undo-${Date.now()}`, app, enterFrom: dir },
      ...d.filter((x) => !(x.kind === "survey" && x.app.id === app.id)),
    ]);
    const r = await result;
    if (r) {
      api("/api/swipe/undo", { method: "POST", json: { swipeId: r.swipeId, removeFromSet: r.addedToSet } }).catch(() => {});
    }
  };

  const saveFromDetails = (app: AppCard) => {
    setDetails(null);
    if (top?.kind === "app" && top.app.id === app.id) {
      setTimeout(() => swipeTop("right"), 250);
    } else {
      api(`/api/set/${app.id}`, { method: "PUT", json: { status: "want" } })
        .then(() => showToast("Добавлено в набор"))
        .catch((e) => showToast(e.message));
    }
  };

  const chips = ["for-me", ...interests];
  const visible = deck.slice(0, 2);

  return (
    <>
      <header className="flex h-14 items-center justify-between px-4">
        <Logo />
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:text-white"
          aria-label="Интересы"
        >
          <IconSettings className="h-6 w-6" />
          Интересы
        </button>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {chips.map((slug) => (
          <Chip key={slug} active={topic === slug} onClick={() => setTopic(slug)}>
            {slug === "for-me" ? "Для меня" : topicBySlug(slug)?.short ?? slug}
          </Chip>
        ))}
        {interests.length === 0 && (
          <Chip onClick={() => setSettingsOpen(true)} className="text-muted">
            + Выбрать темы
          </Chip>
        )}
      </div>

      <div className="relative mx-4 flex-1" style={{ minHeight: 360 }}>
        {visible
          .map((item, i) => (
            <SwipeCard
              key={item.key}
              ref={i === 0 ? topRef : undefined}
              isTop={i === 0}
              depth={i}
              enterFrom={item.kind === "app" ? item.enterFrom : undefined}
              stamps={item.kind === "app" ? { right: "В НАБОР", left: "НЕТ" } : { right: "ПРОПУСК", left: "ПРОПУСК" }}
              onSwiped={(dir) => onSwiped(item, dir)}
              onTap={item.kind === "app" ? () => setDetails(item.app) : undefined}
            >
              {item.kind === "app" ? (
                <AppCardView app={item.app} />
              ) : (
                <SurveyCard
                  app={item.app}
                  onSkip={() => swipeTop("left")}
                  onSubmitted={(amount) => {
                    surveySubmitted.current = true;
                    showToast(`+${amount} ${tokensWord(amount)} — в холде до проверки`);
                    refreshUser().catch(() => {});
                    swipeTop("right");
                  }}
                />
              )}
            </SwipeCard>
          ))
          .reverse()}

        {deck.length === 0 && !loading && exhausted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[24px] bg-surface-1 p-8 text-center">
            <div className="font-display text-2xl font-bold">Ты всё посмотрел</div>
            <p className="text-muted">Новые приложения появятся скоро.</p>
            <Link href="/set" className="inline-flex min-h-11 items-center rounded-full bg-lime px-5 text-sm font-semibold text-on-lime">
              Перейти в набор
            </Link>
            {topic !== "for-me" && (
              <button className="min-h-11 text-sm text-muted" onClick={() => setTopic("for-me")}>
                Вернуться к «Для меня»
              </button>
            )}
          </div>
        )}
        {deck.length === 0 && loading && (
          <div className="absolute inset-0 animate-pulse rounded-[24px] bg-surface-1 shadow-card" />
        )}
      </div>

      <div className="flex items-end justify-center gap-6 px-4 py-3">
        <ActionButton label="Нет" aria-label="Нет, пропустить карточку" big onClick={() => swipeTop("left")} disabled={!top || busy}>
          <IconX className="h-7 w-7" />
        </ActionButton>
        <ActionButton label="Назад" aria-label="Назад, вернуть предыдущую карточку" onClick={undo} disabled={!last || busy}>
          <IconUndo className="h-5 w-5" />
        </ActionButton>
        <ActionButton
          label="В набор"
          aria-label="Сохранить в набор"
          big
          primary
          onClick={() => swipeTop("right")}
          disabled={!top || busy || top.kind === "survey"}
        >
          <IconHeart className="h-7 w-7" />
        </ActionButton>
      </div>

      <DetailsSheet app={details} onClose={() => setDetails(null)} onSave={saveFromDetails} />

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} label="Интересы">
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-display text-2xl font-bold">Интересы</h2>
            <p className="text-sm text-muted">Лента подстроится сразу.</p>
          </div>
          <InterestsGrid
            value={interests}
            onChange={(v) => {
              if (user && v.length === 0) return showToast("Оставь хотя бы одну тему");
              if (!v.includes(topic)) setTopic("for-me");
              setInterests(v).catch((e) => showToast(e.message));
            }}
          />
          <Button onClick={() => setSettingsOpen(false)}>Готово</Button>
        </div>
      </Sheet>

      <Sheet
        label="Регистрация"
        open={regOpen}
        onClose={() => {
          setRegOpen(false);
          track("reg_prompt_dismiss", {});
        }}
      >
        <div className="flex flex-col gap-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] bg-lime text-on-lime">
            <IconGift className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold">
            Зарегистрируйся и получи {config.welcomeBonus} {tokensWord(config.welcomeBonus)}
          </h2>
          <p className="text-sm text-muted">Набор сохранится в аккаунте, а за короткие опросы будут начисляться токены. Начисления сначала попадают в холд и подтверждаются после проверки.</p>
          <Button
            onClick={() => {
              track("reg_prompt_accept", {});
              setRegOpen(false);
              router.push("/signup");
            }}
          >
            Получить бонус
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setRegOpen(false);
              track("reg_prompt_dismiss", {});
            }}
          >
            Позже
          </Button>
        </div>
      </Sheet>

      <Toast message={toast} />
    </>
  );
}

function ActionButton({
  label,
  children,
  big,
  primary,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; big?: boolean; primary?: boolean }) {
  return (
    <button {...props} className="group flex min-w-11 flex-col items-center gap-1 disabled:cursor-not-allowed">
      <span
        className={`flex items-center justify-center rounded-full transition-transform duration-[160ms] group-active:scale-90 group-disabled:group-active:scale-100 ${
          big ? "h-16 w-16" : "h-12 w-12"
        } ${
          primary
            ? "bg-lime text-on-lime group-disabled:bg-surface-2 group-disabled:text-subtle"
            : "bg-surface-2 text-white ring-1 ring-inset ring-line group-hover:bg-surface-3 group-disabled:text-subtle"
        }`}
      >
        {children}
      </span>
      <span className="text-xs font-medium text-muted group-disabled:text-subtle">{label}</span>
    </button>
  );
}
