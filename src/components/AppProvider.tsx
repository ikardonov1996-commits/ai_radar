"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicConfig } from "@/lib/config";
import { api, lsGet, lsSet, syncAnonId } from "@/lib/client";

export type ClientUser = {
  id: string;
  email: string;
  interests: string[];
  balances: { confirmed: number; pending: number };
};

type Ctx = {
  user: ClientUser | null;
  config: PublicConfig;
  interests: string[];
  setInterests: (next: string[]) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
const ANON_INTERESTS = "ar_interests";

export function AppProvider({
  initialUser,
  config,
  children,
}: {
  initialUser: ClientUser | null;
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [anonInterests, setAnonInterests] = useState<string[]>([]);

  useEffect(() => {
    syncAnonId();
    setAnonInterests(lsGet<string[]>(ANON_INTERESTS, []));
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api<{ user: Omit<ClientUser, "balances"> | null; balances?: ClientUser["balances"] }>("/api/me");
    setUser(r.user ? { ...r.user, balances: r.balances ?? { confirmed: 0, pending: 0 } } : null);
  }, []);

  const setInterests = useCallback(
    async (next: string[]) => {
      if (user) {
        setUser({ ...user, interests: next });
        await api("/api/me/interests", { method: "PUT", json: { interests: next } });
      } else {
        setAnonInterests(next);
        lsSet(ANON_INTERESTS, next);
      }
    },
    [user],
  );

  return (
    <AppContext.Provider
      value={{ user, config, interests: user ? user.interests : anonInterests, setInterests, refreshUser }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}
