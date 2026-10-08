"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type Dir = "left" | "right";
export type SwipeCardHandle = { swipe: (dir: Dir) => void };

// Motion per design system: swipe 220ms ease-out, return 160–220ms.
const EASE = [0.2, 0.8, 0.2, 1] as const;
const RETURN = { type: "tween", ease: EASE, duration: 0.2 } as const;
const THRESHOLD = 0.3; // share of card width
const FLICK_VELOCITY = 700; // px/s

type Props = {
  isTop: boolean;
  depth: number; // 0 = top, 1 = the one peeking behind
  enterFrom?: Dir; // for undo: fly back in from this side
  stamps?: { right: string; left: string };
  onSwiped: (dir: Dir) => void;
  onTap?: () => void;
  children: React.ReactNode;
};

/** Tinder-style card: follows the finger, tilts, flies away past the threshold, springs back otherwise. */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { isTop, depth, enterFrom, stamps, onSwiped, onTap, children },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const width = () => el.current?.offsetWidth ?? 360;
  const x = useMotionValue(enterFrom ? (enterFrom === "right" ? 1 : -1) * 600 : 0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const rightOpacity = useTransform(x, [24, 110], [0, 1]);
  const leftOpacity = useTransform(x, [-110, -24], [1, 0]);
  const leaving = useRef(false);
  const dragged = useRef(false);

  useEffect(() => {
    if (enterFrom) {
      x.set((enterFrom === "right" ? 1 : -1) * width() * 1.5);
      animate(x, 0, { type: "tween", ease: EASE, duration: 0.22 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fly = (dir: Dir, velocity = 0) => {
    if (leaving.current) return;
    leaving.current = true;
    const target = (dir === "right" ? 1 : -1) * width() * 1.6;
    const duration = velocity > 1500 ? 0.16 : 0.22;
    animate(x, target, { type: "tween", ease: EASE, duration }).then(() => onSwiped(dir));
    animate(y, y.get() + 30, { type: "tween", ease: EASE, duration });
  };

  useImperativeHandle(ref, () => ({ swipe: (dir) => fly(dir) }));

  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{ scale: depth === 0 ? 1 : 0.95, y: depth === 0 ? 0 : 14 }}
      transition={RETURN}
      style={{ zIndex: 10 - depth }}
    >
      <motion.div
        ref={el}
        className="relative h-full w-full touch-none select-none"
        style={{ x, y, rotate }}
        drag={isTop}
        dragMomentum={false}
        dragElastic={1}
        onPointerDown={() => (dragged.current = false)}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          const w = width();
          if (info.offset.x > w * THRESHOLD || info.velocity.x > FLICK_VELOCITY) fly("right", info.velocity.x);
          else if (info.offset.x < -w * THRESHOLD || info.velocity.x < -FLICK_VELOCITY) fly("left", -info.velocity.x);
          else {
            animate(x, 0, RETURN);
            animate(y, 0, RETURN);
          }
        }}
        onClick={() => {
          if (!dragged.current && isTop && !leaving.current) onTap?.();
        }}
      >
        {children}
        {stamps && isTop && (
          <>
            <motion.div
              style={{ opacity: rightOpacity }}
              className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-lime bg-bg/40 px-3 py-1 font-display text-2xl font-bold tracking-wider text-lime"
            >
              {stamps.right}
            </motion.div>
            <motion.div
              style={{ opacity: leftOpacity }}
              className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-4 border-white bg-bg/40 px-3 py-1 font-display text-2xl font-bold tracking-wider text-white"
            >
              {stamps.left}
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
});
