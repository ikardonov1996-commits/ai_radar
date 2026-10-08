"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { IconAlert } from "./icons";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#DFFF00" />
        <path d="M16 46L27 18h4l11 28M20.5 36h17" fill="none" stroke="#09090A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 12l1.8 4.2L54 18l-4.2 1.8L48 24l-1.8-4.2L42 18l4.2-1.8z" fill="#09090A" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight text-white">AI Radar</span>
    </div>
  );
}

const BUTTON = {
  primary: "bg-lime text-on-lime disabled:bg-surface-2 disabled:text-subtle",
  secondary: "bg-surface-2 text-white hover:bg-surface-3 disabled:text-subtle",
  outline: "bg-surface-1 text-white ring-1 ring-inset ring-outline hover:bg-surface-2 disabled:text-subtle",
  ghost: "bg-transparent text-muted hover:text-white disabled:text-subtle",
  destructive: "bg-surface-2 text-error hover:bg-surface-3",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-[transform,background-color] duration-[160ms] active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${BUTTON[variant]} ${className}`}
    />
  );
}

export function Chip({
  active,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-[160ms] ${
        active ? "bg-lime text-on-lime" : "bg-surface-2 text-white hover:bg-surface-3"
      } ${className}`}
    />
  );
}

export function Tag({ children, onPhoto }: { children: React.ReactNode; onPhoto?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        onPhoto ? "bg-bg/70 text-white backdrop-blur" : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 text-sm text-error">
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Bottom sheet; on desktop it stays inside the 480px column. */
export function Sheet({
  open,
  onClose,
  children,
  full,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  full?: boolean;
  label?: string;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center">
          <motion.div
            className="absolute inset-0 bg-bg-deep/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`absolute bottom-0 w-full max-w-[480px] overflow-y-auto rounded-t-[24px] bg-surface-1 shadow-card pb-safe ${
              full ? "top-0 rounded-t-none sm:top-4 sm:rounded-t-[24px]" : "max-h-[90dvh]"
            }`}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function AppIcon({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className="shrink-0 rounded-[22%] bg-surface-2 object-cover"
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-[22%] bg-surface-2 font-display font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18 }}
          className="fixed top-16 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-surface-3 px-4 py-3 text-sm text-white shadow-card"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
