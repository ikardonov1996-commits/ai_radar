"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, tokensWord } from "@/lib/client";
import { useApp } from "./AppProvider";
import { Button, ErrorText } from "./ui";
import { IconCheck, IconAlert, IconSpark } from "./icons";

type Tx = {
  id: string;
  createdAt: string;
  title: string;
  amount: number;
  status: "pending" | "confirmed" | "rejected";
  reason: string | null;
};
type Data = {
  balances: { confirmed: number; pending: number };
  lastDay: { date: string; confirmed: number; rejected: number; reasons: { reason: string; amount: number }[] } | null;
  history: Tx[];
};

const STATUS = {
  pending: { label: "В холде", cls: "text-warning" },
  confirmed: { label: "Подтверждено", cls: "text-success" },
  rejected: { label: "Отклонено", cls: "text-error" },
} as const;

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export function RewardsScreen() {
  const router = useRouter();
  const { user, config, refreshUser } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Data>("/api/rewards")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [user]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    await refreshUser();
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4">
        <h1 className="font-display text-[30px] font-bold leading-[34px]">Награды</h1>
        <div className="flex flex-col gap-3 rounded-[24px] bg-surface-1 p-5">
          <div className="font-display text-2xl font-bold">
            +{config.welcomeBonus} {tokensWord(config.welcomeBonus)} за регистрацию
          </div>
          <p className="text-sm text-muted">
            Токены начисляются за регистрацию и короткие опросы о сохранённых приложениях. Свайпы не оплачиваются.
          </p>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-lime px-5 text-sm font-semibold text-on-lime"
          >
            Зарегистрироваться
          </Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted">
            Уже есть аккаунт? Войти
          </Link>
        </div>
        <Rules />
      </div>
    );
  }

  const b = data?.balances ?? user.balances;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="font-display text-[30px] font-bold leading-[34px]">Награды</h1>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-[24px] bg-surface-1 p-4">
          <div className="text-xs font-medium text-muted">Доступно</div>
          <div className="font-display text-[48px] font-bold leading-[52px] text-lime">{b.confirmed}</div>
          <div className="text-xs text-subtle">подтверждено</div>
        </div>
        <div className="rounded-[24px] bg-surface-1 p-4">
          <div className="text-xs font-medium text-muted">В холде</div>
          <div className="font-display text-[48px] font-bold leading-[52px] text-white">{b.pending}</div>
          <div className="text-xs text-subtle">на проверке</div>
        </div>
      </section>

      {data?.lastDay && (
        <section className="flex flex-col gap-2 rounded-[20px] bg-surface-1 p-4 text-sm">
          <div className="font-semibold">Проверка за {fmtDate(data.lastDay.date)}</div>
          <div className="flex items-center gap-2 text-success">
            <IconCheck className="h-4 w-4" /> Подтверждено: {data.lastDay.confirmed} {tokensWord(data.lastDay.confirmed)}
          </div>
          {data.lastDay.rejected > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-error">
                <IconAlert className="h-4 w-4" /> Отклонено: {data.lastDay.rejected} {tokensWord(data.lastDay.rejected)}
              </div>
              {data.lastDay.reasons.map((r) => (
                <div key={r.reason} className="pl-6 text-muted">
                  {r.reason} — {r.amount}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-[20px] bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Вывод</div>
            <div className="text-sm text-muted">
              Доступен от {config.withdrawMin} {tokensWord(config.withdrawMin)}
            </div>
          </div>
          <Button variant="secondary" disabled aria-disabled>
            Скоро
          </Button>
        </div>
        <p className="text-xs text-subtle">Сроки и порядок вывода ещё не утверждены. Сейчас токены — внутренние баллы.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-bold">История</h2>
        {error && <ErrorText>{error}</ErrorText>}
        {!data && !error && <div className="h-16 animate-pulse rounded-[20px] bg-surface-1" />}
        {data?.history.length === 0 && <p className="text-sm text-muted">Пока нет начислений.</p>}
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[20px] bg-surface-1">
          {data?.history.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t.title}</div>
                <div className="text-xs text-subtle">{fmtDate(t.createdAt)}</div>
                {t.reason && <div className="mt-1 text-xs text-error">{t.reason}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className={`font-display font-bold ${t.status === "rejected" ? "text-subtle line-through" : ""}`}>
                  +{t.amount}
                </div>
                <div className={`text-xs font-medium ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Rules />

      <div className="flex flex-col items-center gap-1 pb-6">
        <div className="text-xs text-subtle">{user.email}</div>
        <Button variant="outline" onClick={logout}>
          Выйти
        </Button>
      </div>
    </div>
  );
}

function Rules() {
  const { config } = useApp();
  return (
    <section className="flex flex-col gap-2 rounded-[20px] bg-surface-1 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <IconSpark className="h-4 w-4" /> Правила
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
        <li>
          За регистрацию — {config.welcomeBonus}, за засчитанный опрос — {config.surveyReward} {tokensWord(config.surveyReward)}.
          Свайпы не оплачиваются.
        </li>
        <li>Каждое начисление сначала в холде. Раз в сутки (00:00 UTC) проверка подтверждает его или отклоняет с причиной.</li>
        <li>
          Отклоняем: опрос быстрее 4 секунд, одинаковые ответы 5 раз подряд, скопированный комментарий, больше 3 аккаунтов с
          одного устройства или сети за сутки.
        </li>
        <li>
          Дневной лимит за опросы — {config.dailyCap} {tokensWord(config.dailyCap)}, всё сверх него отклоняется.
        </li>
      </ul>
    </section>
  );
}
