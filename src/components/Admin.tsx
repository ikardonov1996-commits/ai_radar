"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { App } from "@prisma/client";
import { toCard } from "@/lib/apps";
import { TOPICS } from "@/lib/topics";
import { api } from "@/lib/client";
import { AppCardView } from "./AppCardView";
import { AppIcon, Button, Chip, ErrorText, Logo, Sheet, Toast } from "./ui";

type Summary = Awaited<ReturnType<typeof import("@/lib/stats").adminSummary>>;
type Stats = Summary["today"];
// JSON over the wire: dates are strings.
type AdminApp = Omit<App, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4 rounded-[24px] bg-surface-1 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api("/api/admin/login", { method: "POST", json: { token } });
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <Logo />
      <h1 className="font-display text-2xl font-bold">Админка</h1>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ADMIN_TOKEN"
        aria-label="Токен администратора"
        className="min-h-12 rounded-[14px] bg-surface-2 px-4 text-white ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-white"
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" disabled={!token}>
        Войти
      </Button>
    </form>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export function AdminStats({ summary }: { summary: Summary }) {
  const rows: { label: string; get: (s: Stats) => string | number }[] = [
    { label: "Визиты (уникальные устройства)", get: (s) => s.visits },
    { label: "Свайпы", get: (s) => s.swipes },
    { label: "Доля вправо", get: (s) => `${pct(s.rightShare)}${s.swipes ? ` из ${s.swipes}` : ""}` },
    { label: "Регистрации", get: (s) => s.signups },
    { label: "Опросы", get: (s) => s.surveys },
    { label: "Переходы в стор / на сайт", get: (s) => s.outbound },
  ];
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="text-sm text-muted">
          Опубликовано <span className="font-semibold text-white">{summary.published}</span> из {summary.total} карточек
        </div>
      </div>
      <div className="overflow-hidden rounded-[20px] bg-surface-1">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">Метрика</th>
              <th className="p-3 text-right font-medium">Сегодня (UTC)</th>
              <th className="p-3 text-right font-medium">7 дней</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="p-3 text-muted">{r.label}</td>
                <td className="p-3 text-right font-display font-bold">{r.get(summary.today)}</td>
                <td className="p-3 text-right font-display font-bold">{r.get(summary.week)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const SOURCES = [
  { v: "", label: "Все источники" },
  { v: "appstore", label: "App Store" },
  { v: "googleplay", label: "Google Play" },
  { v: "web", label: "Веб" },
  { v: "demo", label: "Демо" },
];

export function AdminApps() {
  const router = useRouter();
  const [apps, setApps] = useState<AdminApp[] | null>(null);
  const [status, setStatus] = useState<"" | "published" | "draft">("draft");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminApp | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), 2400);
  };

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ status, source, q });
    const r = await api<{ apps: AdminApp[] }>(`/api/admin/apps?${qs}`);
    setApps(r.apps);
    setSelected(new Set());
  }, [status, source, q]);

  useEffect(() => {
    const t = setTimeout(() => load().catch((e) => flash(e.message)), 200);
    return () => clearTimeout(t);
  }, [load]);

  const publish = async (ids: string[], published: boolean) => {
    if (!ids.length) return;
    const r = await api<{ updated: number }>("/api/admin/publish", { method: "POST", json: { ids, published } });
    flash(`${published ? "Опубликовано" : "Снято с публикации"}: ${r.updated}`);
    await load();
    router.refresh();
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Карточки</h2>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["draft", "Черновики"],
            ["published", "Опубликованные"],
            ["", "Все"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} active={status === v} onClick={() => setStatus(v)}>
            {label}
          </Chip>
        ))}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Источник"
          className="min-h-11 rounded-full bg-surface-2 px-4 text-sm text-white"
        >
          {SOURCES.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию"
          aria-label="Поиск"
          className="min-h-11 flex-1 rounded-full bg-surface-2 px-4 text-sm text-white ring-1 ring-inset ring-line focus:outline-none focus:ring-white"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="secondary"
          onClick={() =>
            setSelected(selected.size === apps?.length ? new Set() : new Set(apps?.map((a) => a.id) ?? []))
          }
        >
          {selected.size && selected.size === apps?.length ? "Снять выделение" : "Выделить все"}
        </Button>
        <Button disabled={!selected.size} onClick={() => publish([...selected], true)}>
          Опубликовать ({selected.size})
        </Button>
        <Button variant="outline" disabled={!selected.size} onClick={() => publish([...selected], false)}>
          Снять с публикации
        </Button>
        <span className="text-muted">Всего: {apps?.length ?? "…"}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {apps?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-[20px] bg-surface-1 p-3">
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={() => toggle(a.id)}
              aria-label={`Выбрать ${a.name}`}
              className="h-5 w-5 shrink-0 accent-[#DFFF00]"
            />
            <AppIcon src={a.iconUrl} name={a.name} size={44} />
            <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(a)}>
              <div className="truncate font-semibold">{a.name}</div>
              <div className="truncate text-xs text-muted">{a.oneLiner || "— нет описания —"}</div>
              <div className="truncate text-xs text-subtle">
                {a.source} · {a.platforms.join(", ")} · {a.topics.join(", ") || "без тем"}
              </div>
            </button>
            <Button
              variant={a.published ? "outline" : "primary"}
              className="shrink-0 px-3"
              onClick={() => publish([a.id], !a.published)}
            >
              {a.published ? "Снять" : "Опубликовать"}
            </Button>
          </div>
        ))}
      </div>

      <EditSheet
        app={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          flash("Сохранено");
          await load();
        }}
      />
      <Toast message={toast} />
    </section>
  );
}

function EditSheet({ app, onClose, onSaved }: { app: AdminApp | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    oneLiner: "",
    topics: [] as string[],
    imageUrl: "",
    iconUrl: "",
    ios: "",
    android: "",
    web: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    const urls = (app.storeUrls ?? {}) as { ios?: string; android?: string; web?: string };
    setForm({
      name: app.name,
      oneLiner: app.oneLiner,
      topics: app.topics,
      imageUrl: app.imageUrl ?? "",
      iconUrl: app.iconUrl ?? "",
      ios: urls.ios ?? "",
      android: urls.android ?? "",
      web: urls.web ?? "",
    });
    setError(null);
  }, [app]);

  if (!app) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const preview = toCard({
    ...(app as unknown as App),
    name: form.name,
    oneLiner: form.oneLiner,
    topics: form.topics,
    imageUrl: form.imageUrl || null,
    iconUrl: form.iconUrl || null,
  });

  const field = (key: keyof typeof form, label: string, max?: number) => (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs font-medium text-muted">
        {label}
        {max && (
          <span className={(form[key] as string).length > max ? "text-error" : ""}>
            {(form[key] as string).length}/{max}
          </span>
        )}
      </span>
      <input
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="min-h-11 rounded-[14px] bg-surface-2 px-3 text-sm text-white ring-1 ring-inset ring-line focus:outline-none focus:ring-white"
      />
    </label>
  );

  const save = async () => {
    setError(null);
    try {
      await api(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        json: {
          name: form.name,
          oneLiner: form.oneLiner,
          topics: form.topics,
          imageUrl: form.imageUrl,
          iconUrl: form.iconUrl,
          storeUrls: { ios: form.ios, android: form.android, web: form.web },
        },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Sheet open onClose={onClose} full label="Редактирование">
      <div className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl font-bold">Редактирование</h2>
        <div className="mx-auto h-[420px] w-full max-w-[320px]">
          <AppCardView app={preview} />
        </div>
        {field("name", "Название")}
        {field("oneLiner", "Одна строка (до 70)", 70)}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Темы</span>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => {
              const on = form.topics.includes(t.slug);
              return (
                <Chip
                  key={t.slug}
                  active={on}
                  onClick={() =>
                    setForm({ ...form, topics: on ? form.topics.filter((x) => x !== t.slug) : [...form.topics, t.slug] })
                  }
                >
                  {t.short}
                </Chip>
              );
            })}
          </div>
        </div>
        {field("imageUrl", "Изображение (URL)")}
        {field("iconUrl", "Иконка (URL)")}
        {field("ios", "App Store")}
        {field("android", "Google Play")}
        {field("web", "Сайт")}
        {app.description && (
          <details className="text-sm text-muted">
            <summary className="min-h-11 cursor-pointer py-2 text-white">Исходное описание</summary>
            <p className="whitespace-pre-line">{app.description}</p>
          </details>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <div className="sticky bottom-0 flex gap-2 bg-surface-1 py-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button className="flex-1" onClick={save} disabled={form.oneLiner.length > 70 || !form.name.trim()}>
            Сохранить
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
