"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * Thin progress bar at top of viewport during route transitions.
 * Matches Aether's 120ms timing with a subtle grow animation.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;

      // Start: show bar and animate to ~80%
      setVisible(true);
      setProgress(15);

      // Quick ramp up
      timeoutRef.current = setTimeout(() => setProgress(45), 50);
      const t2 = setTimeout(() => setProgress(75), 120);
      const t3 = setTimeout(() => setProgress(90), 200);

      // Complete: jump to 100% then fade out
      const t4 = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 150);
      }, 300);

      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 9999,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-bright))",
          borderRadius: "0 2px 2px 0",
          transition: progress > 0 ? "width 200ms ease" : "none",
          boxShadow: "0 0 8px var(--color-primary)",
        }}
      />
    </div>
  );
}
