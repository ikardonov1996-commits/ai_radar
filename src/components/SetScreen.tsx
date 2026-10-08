"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import type { AppCard } from "@/lib/apps";
import { TOPICS, topicBySlug } from "@/lib/topics";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import { DetailsSheet, OpenLink } from "./DetailsSheet";
import { AppIcon, Chip, ErrorText, Toast } from "./ui";
import { IconCheck, IconMore, IconTrash } from "./icons";

type Item = { appId: string; status: "want" | "using"; app: AppCard };
type Filter = "all" | "using" | "want";

const FILTERS: { v: Filter; label: string }[] = [
  { v: "all", label: "Все" },
  { v: "using", label: "Пользуюсь" },
  { v: "want", label: "Хочу попробовать" },
];

export function SetScreen() {
  const { user } = useApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [details, setDetails] = useState<AppCard | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Item[] }>("/api/set")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [user?.id]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), 2400);
  };

  const setStatus = async (appId: string, status: Item["status"]) => {
    setItems((list) => list?.map((i) => (i.appId === appId ? { ...i, status } : i)) ?? null);
    try {
      await api(`/api/set/${appId}`, { method: "PUT", json: { status } });
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const remove = async (appId: string) => {
    const prev = items;
    setItems((list) => list?.filter((i) => i.appId !== appId) ?? null);
    try {
      await api(`/api/set/${appId}`, { method: "DELETE" });
      flash("Удалено из набора");
    } catch (e) {
      setItems(prev);
      flash((e as Error).message);
    }
  };

  const visible = (items ?? []).filter((i) => filter === "all" || i.status === filter);
  // Group by the first known topic, in the order of the interests list.
  const groups: { slug: string; label: string; items: Item[] }[] = TOPICS.map((t) => ({
    slug: t.slug,
    label: t.label,
    items: visible.filter((i) => (i.app.topics.find((x) => topicBySlug(x)) ?? "other") === t.slug),
  }));
  const other = visible.filter((i) => !i.app.topics.some((x) => topicBySlug(x)));
  if (other.length) groups.push({ slug: "other", label: "Другое", items: other });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="font-display text-[30px] font-bold leading-[34px]">Мой набор</h1>
        <p className="text-sm text-muted">Сохранённое — ещё не значит использованное. Отмечай, чем уже пользуешься.</p>
      </header>

      {!user && (
        <div className="flex flex-col gap-3 rounded-[20px] bg-surface-1 p-4">
          <p className="text-sm">Набор хранится только на этом устройстве. Зарегистрируйся, чтобы не потерять его.</p>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-lime px-5 text-sm font-semibold text-on-lime"
          >
            Зарегистрироваться
          </Link>
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f.v} active={filter === f.v} onClick={() => setFilter(f.v)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {items === null && !error && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[20px] bg-surface-1" />
          ))}
        </div>
      )}
      {items !== null && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[20px] bg-surface-1 p-8 text-center">
          <div className="font-display text-xl font-bold">
            {items.length === 0 ? "Пока пусто" : "В этом фильтре ничего нет"}
          </div>
          <p className="text-sm text-muted">Свайпни карточку вправо в ленте — она появится здесь.</p>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-surface-2 px-5 text-sm font-semibold">
            В ленту
          </Link>
        </div>
      )}

      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.slug} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-muted">{g.label}</h2>
            <AnimatePresence initial={false}>
              {g.items.map((i) => (
                <Row
                  key={i.appId}
                  item={i}
                  onOpen={() => setDetails(i.app)}
                  onToggleUsing={() => setStatus(i.appId, i.status === "using" ? "want" : "using")}
                  onRemove={() => remove(i.appId)}
                />
              ))}
            </AnimatePresence>
          </section>
        ))}
      <div className="text-center text-xs text-subtle">Свайп влево по строке — удалить</div>

      <DetailsSheet app={details} onClose={() => setDetails(null)} />
      <Toast message={toast} />
    </div>
  );
}

function Row({
  item,
  onOpen,
  onToggleUsing,
  onRemove,
}: {
  item: Item;
  onOpen: () => void;
  onToggleUsing: () => void;
  onRemove: () => void;
}) {
  const x = useMotionValue(0);
  const trashOpacity = useTransform(x, [-120, -40], [1, 0]);
  const [menu, setMenu] = useState(false);
  const using = item.status === "using";

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        <motion.div
          style={{ opacity: trashOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-end gap-2 rounded-[20px] bg-error/15 pr-5 text-sm font-semibold text-error"
        >
          <IconTrash className="h-5 w-5" /> Удалить
        </motion.div>
        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -160, right: 0 }}
          dragElastic={0.1}
          dragDirectionLock
          onDragEnd={(_, info) => {
            if (info.offset.x < -110) onRemove();
            else animate(x, 0, { duration: 0.18 });
          }}
          className="relative flex items-center gap-3 rounded-[20px] bg-surface-1 p-3 touch-pan-y"
        >
          <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <AppIcon src={item.app.iconUrl} name={item.app.name} size={48} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{item.app.name}</div>
              <div className="truncate text-sm text-muted">{item.app.oneLiner}</div>
            </div>
          </button>
          <OpenLink app={item.app} short className="shrink-0 bg-surface-2 px-3 text-white" />
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Ещё действия"
            aria-expanded={menu}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
          >
            <IconMore className="h-5 w-5" />
          </button>
        </motion.div>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-3">
        <button
          onClick={onToggleUsing}
          aria-pressed={using}
          className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
            using ? "bg-surface-2 text-success" : "text-muted hover:text-white"
          }`}
        >
          {using ? <IconCheck className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-outline" />}
          {using ? "Пользуюсь" : "Отметить «Пользуюсь»"}
        </button>
        {menu && (
          <button
            onClick={onRemove}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold text-error"
          >
            <IconTrash className="h-4 w-4" /> Удалить
          </button>
        )}
      </div>
    </motion.div>
  );
}
