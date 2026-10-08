"use client";

import type { StoreUrls } from "./apps";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Что-то пошло не так");
  return data as T;
}

/** Fire-and-forget event that survives page navigation. */
export function track(type: string, payload: Record<string, unknown> = {}) {
  const body = JSON.stringify({ type, payload });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

export function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** The best link for this device: its own store first, then the web, then any store. */
export function bestLink(urls: StoreUrls): { url: string; kind: keyof StoreUrls } | null {
  const p = detectPlatform();
  const order: (keyof StoreUrls)[] =
    p === "ios" ? ["ios", "web", "android"] : p === "android" ? ["android", "web", "ios"] : ["web", "ios", "android"];
  for (const k of order) if (urls[k]) return { url: urls[k]!, kind: k };
  return null;
}

const ANON_KEY = "ar_anon";
const ANON_COOKIE = "ar_anon";

function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
}

/** Keep the anonymous id in both localStorage and cookie, restoring whichever got lost. */
export function syncAnonId() {
  try {
    const stored = localStorage.getItem(ANON_KEY);
    const cookie = readCookie(ANON_COOKIE);
    const id = stored || cookie || crypto.randomUUID();
    if (!stored) localStorage.setItem(ANON_KEY, id);
    if (cookie !== id) document.cookie = `${ANON_COOKIE}=${id}; path=/; max-age=${400 * 86400}; samesite=lax`;
  } catch {
    /* storage blocked: the middleware cookie still works */
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function ssGet<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function ssSet(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const PRICE_LABEL = { free: "Бесплатно", freemium: "Фримиум", paid: "Платно" } as const;
export const PLATFORM_LABEL = { ios: "iOS", android: "Android", web: "Веб" } as const;

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const tokensWord = (n: number) => plural(n, "токен", "токена", "токенов");
