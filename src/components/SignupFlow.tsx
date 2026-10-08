"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { api, lsGet, tokensWord } from "@/lib/client";
import { useApp } from "./AppProvider";
import { InterestsGrid } from "./InterestsGrid";
import { Button, ErrorText, Logo } from "./ui";
import { IconBack, IconGift } from "./icons";

type Step = "email" | "code" | "interests" | "bonus";
const MIN_INTERESTS = 3;

export function SignupFlow() {
  const router = useRouter();
  const { user, config, refreshUser } = useApp();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Already signed in with interests: nothing to do here.
  useEffect(() => {
    if (user && user.interests.length >= MIN_INTERESTS && step === "email") router.replace("/");
  }, [user, step, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const requestCode = () =>
    run(async () => {
      await api("/api/auth/request-code", { method: "POST", json: { email } });
      setStep("code");
      setCode("");
      setResendIn(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    });

  const verify = (value = code) =>
    run(async () => {
      const r = await api<{ isNew: boolean; needsInterests: boolean }>("/api/auth/verify", {
        method: "POST",
        json: { email, code: value },
      });
      setIsNew(r.isNew);
      await refreshUser();
      if (r.needsInterests) {
        // Start from what the visitor picked before signing up.
        setInterests(lsGet<string[]>("ar_interests", []));
        setStep("interests");
      } else if (r.isNew) setStep("bonus");
      else {
        router.push("/");
        router.refresh();
      }
    });

  const saveInterests = () =>
    run(async () => {
      await api("/api/me/interests", { method: "PUT", json: { interests } });
      await refreshUser();
      if (isNew) setStep("bonus");
      else {
        router.push("/");
        router.refresh();
      }
    });

  return (
    <div className="flex min-h-dvh flex-col gap-6 px-5 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-white">
          <IconBack className="h-5 w-5" /> В ленту
        </Link>
        <Logo />
      </div>

      {step === "email" && (
        <form
          className="flex flex-1 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (config.emailCodes) requestCode();
            else verify("");
          }}
        >
          <StepLabel n={1} />
          <h1 className="font-display text-[30px] font-bold leading-[34px]">
            Регистрация и +{config.welcomeBonus} {tokensWord(config.welcomeBonus)}
          </h1>
          <p className="text-muted">
            {config.emailCodes
              ? "Пришлём на почту 6-значный код. Пароль не нужен. Если аккаунт уже есть — просто войдёшь."
              : "Укажи почту — пароль не нужен. Если аккаунт уже есть — просто войдёшь."}
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-12 rounded-[14px] bg-surface-2 px-4 text-base text-white ring-1 ring-inset ring-line placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white"
            />
          </label>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" disabled={busy || !email} className="mt-auto">
            {busy ? (config.emailCodes ? "Отправляем…" : "Входим…") : config.emailCodes ? "Получить код" : "Продолжить"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form
          className="flex flex-1 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <StepLabel n={1} />
          <h1 className="font-display text-[30px] font-bold leading-[34px]">Введи код из письма</h1>
          <p className="text-muted">
            Отправили на <span className="text-white">{email}</span>. Код действует 10 минут.
          </p>
          <input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Код из письма"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) verify(v);
            }}
            placeholder="••••••"
            className="min-h-16 rounded-[14px] bg-surface-2 px-4 text-center font-display text-[32px] font-bold tracking-[0.4em] text-white ring-1 ring-inset ring-line placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-white"
          />
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("email")}>
              Изменить почту
            </Button>
            <Button type="button" variant="ghost" disabled={resendIn > 0 || busy} onClick={requestCode}>
              {resendIn > 0 ? `Отправить снова через ${resendIn} с` : "Отправить снова"}
            </Button>
          </div>
          <Button type="submit" disabled={busy || code.length !== 6} className="mt-auto">
            {busy ? "Проверяем…" : "Подтвердить"}
          </Button>
        </form>
      )}

      {step === "interests" && (
        <div className="flex flex-1 flex-col gap-4">
          <StepLabel n={2} />
          <h1 className="font-display text-[30px] font-bold leading-[34px]">Что тебе интересно?</h1>
          <p className="text-muted">Выбери минимум {MIN_INTERESTS} темы. Часть ленты всё равно будет про другое — чтобы удивлять.</p>
          <InterestsGrid value={interests} onChange={setInterests} />
          {error && <ErrorText>{error}</ErrorText>}
          <Button
            onClick={saveInterests}
            disabled={busy || interests.length < MIN_INTERESTS}
            className="sticky bottom-4 mt-auto"
          >
            {interests.length < MIN_INTERESTS
              ? `Выбрано ${interests.length} из ${MIN_INTERESTS}`
              : busy
                ? "Сохраняем…"
                : "Продолжить"}
          </Button>
        </div>
      )}

      {step === "bonus" && <Bonus amount={config.welcomeBonus} onDone={() => { router.push("/"); router.refresh(); }} />}
    </div>
  );
}

function StepLabel({ n }: { n: number }) {
  return <div className="text-xs font-medium text-muted">Шаг {n} из 2</div>;
}

function Bonus({ amount, onDone }: { amount: number; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? amount : 0);
  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setShown(Math.round(amount * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount, reduce]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <motion.div
        initial={reduce ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex h-24 w-24 items-center justify-center rounded-[24px] bg-lime text-on-lime"
      >
        <IconGift className="h-12 w-12" />
      </motion.div>
      <div className="font-display text-[48px] font-bold leading-[52px]">+{shown}</div>
      <h1 className="font-display text-2xl font-bold">Бонус начислен</h1>
      <p className="max-w-xs text-muted">
        {amount} {tokensWord(amount)} уже в холде. Они подтвердятся после ежедневной проверки.
      </p>
      <Button onClick={onDone} className="w-full">
        В ленту
      </Button>
    </div>
  );
}
