"use client";

import { usePathname } from "next/navigation";

export default function GlobalHeader() {
  const pathname = usePathname();

  // Hide nav on auth, onboarding, and session routes
  const hiddenRoutes = ["/auth", "/onboarding", "/session"];
  const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));

  if (shouldHide) return null;

  return (
    <div style={{
      position: "fixed",
      top: "1.75rem",
      left: "max(2rem, env(safe-area-inset-left))",
      zIndex: 100,
      pointerEvents: "none"
    }}>
      <h1 style={{ 
        fontFamily: "var(--font-headline)", 
        fontSize: "1.35rem", 
        color: "var(--color-primary-bright)", 
        fontWeight: 700, 
        letterSpacing: "0.5px" 
      }}>
        Aether
      </h1>
    </div>
  );
}
