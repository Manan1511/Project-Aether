"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON_SIZE = 24;

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "var(--color-secondary-text)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function UploadIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "var(--color-secondary-text)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function InsightsIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "var(--color-secondary-text)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "var(--color-secondary-text)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<{ active: boolean }>> = {
  library: LibraryIcon,
  upload: UploadIcon,
  insights: InsightsIcon,
  profile: ProfileIcon,
};

const NAV_TABS = [
  { id: "library", label: "Library", path: "/library" },
  { id: "upload", label: "Upload", path: "/upload" },
  { id: "insights", label: "Insights", path: "/insights" },
  { id: "profile", label: "Profile", path: "/profile" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  // Hide nav on auth, onboarding, and session routes
  const hiddenRoutes = ["/auth", "/onboarding", "/session"];
  const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));

  if (shouldHide) return null;

  return (
    <nav
      id="bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: "var(--z-nav)" as string,
        backgroundColor: "var(--color-surface-container)",
        borderTop: "1px solid rgba(72, 72, 72, 0.2)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: "64px",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          const IconComponent = ICON_MAP[tab.id];

          return (
            <Link
              key={tab.id}
              href={tab.path}
              prefetch={true}
              id={`nav-${tab.id}`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                padding: "8px 12px",
                background: "none",
                textDecoration: "none",
                transition: "opacity 120ms ease",
                minWidth: "60px",
              }}
            >
              <IconComponent active={isActive} />
              {isActive && (
                <span
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: "0.625rem",
                    fontWeight: 600,
                    color: "var(--color-primary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
