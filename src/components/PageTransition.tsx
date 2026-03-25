"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const FADE_DURATION_MS = 120;

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [opacity, setOpacity] = useState(1);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // Route changed — fade out, swap content, fade in
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setOpacity(0);

      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setOpacity(1);
      }, FADE_DURATION_MS);

      return () => clearTimeout(timer);
    } else {
      // Same route, just update children (e.g. data refresh)
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        opacity,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
        willChange: "opacity",
      }}
    >
      {displayChildren}
    </div>
  );
}
