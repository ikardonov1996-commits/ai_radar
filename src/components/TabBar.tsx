"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBookmark, IconCards, IconGift } from "./icons";

const TABS = [
  { href: "/", label: "Лента", Icon: IconCards },
  { href: "/set", label: "Набор", Icon: IconBookmark },
  { href: "/rewards", label: "Награды", Icon: IconGift },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 bg-bg-deep/95 backdrop-blur pb-safe">
      <div className="flex border-t border-line/60">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                active ? "text-lime" : "text-muted hover:text-white"
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Screen({ children, tabs = true }: { children: React.ReactNode; tabs?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col ${tabs ? "pb-20" : ""}`}>
      {children}
      {tabs && <TabBar />}
    </div>
  );
}
