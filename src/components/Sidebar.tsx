"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Simple custom SVG icons for the new Figma tabs
const ICON_SIZE = 20;

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function PathIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function FocusIcon({ active }: { active: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-primary)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m8 17 4 4 4-4" />
    </svg>
  );
}

const NAV_TABS = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: DashboardIcon },
  { id: "learning-path", label: "Learning Path", path: "/path", icon: PathIcon },
  { id: "library", label: "Library", path: "/library", icon: LibraryIcon },
  { id: "progress", label: "Progress", path: "/progress", icon: ProgressIcon },
  { id: "focus-mode", label: "Focus Mode", path: "/focus", icon: FocusIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Hide nav on auth and onboarding routes
  const hiddenRoutes = ["/auth", "/onboarding", "/session"];
  const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));

  if (shouldHide) return null;

  return (
    <aside className="aether-sidebar">
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">Aether AI</span>
          <span className="sidebar-logo-subtitle">Cognitive Workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          const IconComponent = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.path}
              prefetch={true}
              id={`nav-desktop-${tab.id}`}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <IconComponent active={isActive} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <Link href="/upload" className="btn-new-session" style={{ textDecoration: 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </Link>
        <Link href="/help" className="sidebar-link" style={{ marginTop: "1rem" }}>
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Help
        </Link>
        <button className="sidebar-link" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
