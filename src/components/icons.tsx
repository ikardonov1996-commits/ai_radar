// Small inline icon set, stroke = currentColor.
type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconX = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconHeart = ({ className, filled }: P & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);
export const IconUndo = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
);
export const IconSettings = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
  </svg>
);
export const IconCards = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="6" y="3" width="12" height="16" rx="3" /><path d="M3 7v11a3 3 0 0 0 3 3h9" /></svg>
);
export const IconBookmark = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M6 4h12v17l-6-4-6 4z" /></svg>
);
export const IconGift = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4s-1 4 4 4zM12 8s1.5-5 4-4 1 4-4 4z" />
  </svg>
);
export const IconExternal = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconStar = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 12l5 5 9-10" /></svg>
);
export const IconMore = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
);
export const IconBack = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconAlert = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
);
export const IconSpark = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></svg>
);
export const IconTrash = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
