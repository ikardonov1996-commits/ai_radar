"use client";

import { TOPICS } from "@/lib/topics";
import { IconCheck } from "./icons";

export function InterestsGrid({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TOPICS.map((t) => {
        const on = value.includes(t.slug);
        return (
          <button
            key={t.slug}
            onClick={() => onChange(on ? value.filter((x) => x !== t.slug) : [...value, t.slug])}
            aria-pressed={on}
            className={`flex min-h-14 items-center justify-between gap-2 rounded-[14px] px-3 py-2 text-left text-sm font-medium leading-tight transition-colors duration-[160ms] ${
              on ? "bg-lime text-on-lime" : "bg-surface-2 text-white hover:bg-surface-3"
            }`}
          >
            <span>{t.label}</span>
            {on && <IconCheck className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
