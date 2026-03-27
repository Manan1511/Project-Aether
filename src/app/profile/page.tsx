"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfileLoading from "./loading";

interface UserStats {
  concepts_covered: number;
  total_session_seconds: number;
  documents_studied: number;
}

interface UserPrefs {
  session_length: number;
  font: string;
  letter_spacing: string;
  theme: string;
  audio_speed: number;
  read_aloud_default: string;
}



export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      setEmail(user.email ?? "");

      const [statsRes, prefsRes] = await Promise.all([
        supabase.from("user_stats").select("*").eq("user_id", user.id).single(),
        supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (prefsRes.data) setPrefs(prefsRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const updatePref = useCallback(async (field: string, value: string | number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPrefs((p) => p ? { ...p, [field]: value } : p);

    await supabase
      .from("user_preferences")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Apply immediately
    const html = document.documentElement;
    if (field === "theme") html.classList.toggle("theme-light", value === "light");
    if (field === "font") html.classList.toggle("font-dyslexic", value === "opendyslexic");
    if (field === "letter_spacing") {
      const v = parseFloat(value as string);
      if (!isNaN(v)) {
        html.style.setProperty("--global-letter-spacing", `${(v - 1.0) * 0.1}em`);
      } else if (value === "wide") {
        html.style.setProperty("--global-letter-spacing", "0.05em");
      } else {
        html.style.setProperty("--global-letter-spacing", "normal");
      }
    }
  }, [supabase]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }, [supabase, router]);

  if (loading) return <ProfileLoading />;

  return (
    <div style={{
      maxWidth: "680px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "3rem",
      }}>
        <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Aether</h1>
      </div>

      {/* User info */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "3rem" }}>
        <div style={{ position: "relative" }}>
          <div style={{
            width: "96px", height: "96px", borderRadius: "50%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-primary-bright)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-headline)", fontSize: "2rem",
            fontWeight: 400, color: "var(--color-on-surface)",
            boxShadow: "0 0 24px -10px rgba(129, 140, 248, 0.4)",
          }}>
            {email.charAt(0).toUpperCase()}
          </div>
          <div style={{
            position: "absolute", bottom: "0", right: "0",
            width: "28px", height: "28px", borderRadius: "50%",
            backgroundColor: "var(--color-surface-variant)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--color-surface)",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
        </div>
        <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "1.375rem", marginTop: "1rem", fontWeight: 400 }}>Jhanvi Vashishth</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--color-secondary-text)", fontWeight: 300, letterSpacing: "0.02em" }}>{email}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem",
          marginBottom: "3rem",
        }}>
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px", padding: "1.25rem" }}>
            <div className="text-label-md" style={{ color: "var(--color-secondary-text)", fontSize: "0.625rem", letterSpacing: "0.1em" }}>CONCEPTS</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "1.75rem", fontWeight: 300, color: "var(--color-primary-dim)" }}>{stats.concepts_covered}</span>
              <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", color: "var(--color-secondary-text)", fontWeight: 500 }}>active</span>
            </div>
          </div>
          
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px", padding: "1.25rem" }}>
            <div className="text-label-md" style={{ color: "var(--color-secondary-text)", fontSize: "0.625rem", letterSpacing: "0.1em" }}>TIME WITH AETHER</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "1.75rem", fontWeight: 300, color: "var(--color-primary-dim)" }}>{Math.floor(stats.total_session_seconds / 60)}</span>
              <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", color: "var(--color-secondary-text)", fontWeight: 500 }}>mins</span>
            </div>
          </div>
          
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px", padding: "1.25rem" }}>
            <div className="text-label-md" style={{ color: "var(--color-secondary-text)", fontSize: "0.625rem", letterSpacing: "0.1em" }}>DOCUMENTS</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "1.75rem", fontWeight: 300, color: "var(--color-primary-dim)" }}>{stats.documents_studied}</span>
              <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", color: "var(--color-secondary-text)", fontWeight: 500 }}>stored</span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Form Flattened */}
      {prefs && (
        <div style={{ paddingBottom: "3rem" }}>
          <div className="text-label-md" style={{ color: "var(--color-secondary-text)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
            INTERFACE PREFERENCE
          </div>

          <SettingRow label="Theme">
            <SegmentedControl
              options={[
                { label: "Dark", value: "dark" },
                { label: "Light", value: "light" },
              ]}
              selected={prefs.theme}
              onChange={(v) => updatePref("theme", v)}
            />
          </SettingRow>

          <SettingRow label="Font Family">
            <SegmentedControl
              options={[
                { label: "Lexend", value: "lexend" },
                { label: "OpenDyslexic", value: "opendyslexic" },
              ]}
              selected={prefs.font || "lexend"}
              onChange={(v) => updatePref("font", v)}
            />
          </SettingRow>

          <SettingRow label="Letter Spacing">
            <div style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "flex-end", gap: "1rem" }}>
              <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-bright)" }}>
                {prefs.letter_spacing === "wide" ? "1.5x" : prefs.letter_spacing === "normal" ? "1.0x" : `${parseFloat(prefs.letter_spacing || "1.0").toFixed(1)}x`}
              </span>
            </div>
          </SettingRow>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem" }}>
            <input 
              type="range" 
              className="aether-slider" 
              min="1" max="2" step="0.5" 
              value={prefs.letter_spacing === "wide" ? 1.5 : (prefs.letter_spacing === "normal" || !prefs.letter_spacing) ? 1.0 : parseFloat(prefs.letter_spacing)} 
              onChange={(e) => updatePref("letter_spacing", e.target.value)} 
              style={{ width: "100%" }} 
            />
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 4px", marginTop: "8px" }}>
              <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>1.0x (Normal)</span>
              <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>1.5x (Wide)</span>
              <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>2.0x (Max)</span>
            </div>
          </div>

          <div className="text-label-md" style={{ marginTop: "3rem", marginBottom: "0.5rem", color: "var(--color-secondary-text)", letterSpacing: "0.1em" }}>
            READING &amp; FOCUS
          </div>

          <SettingRow label="Session Length (mins)">
            <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-bright)" }}>{prefs.session_length} mins</span>
          </SettingRow>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem" }}>
             <input type="range" className="aether-slider" min="5" max="30" step="5" value={prefs.session_length} onChange={(e) => updatePref("session_length", parseInt(e.target.value))} style={{ width: "100%" }} />
             <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 4px", marginTop: "8px" }}>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>5m</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>15m</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>30m</span>
             </div>
          </div>

          <SettingRow label="Read Aloud Volume">
            <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-container)" }}>73%</span>
          </SettingRow>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1rem" }}>
             <input type="range" className="aether-slider" min="0" max="100" step="50" defaultValue="73" style={{ width: "100%", opacity: 0.5 }} disabled />
             <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 4px", marginTop: "8px", opacity: 0.5 }}>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>0%</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>50%</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>100%</span>
             </div>
          </div>

          <SettingRow label="Audio Speed">
             <span style={{ fontFamily: "var(--font-label)", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-primary-bright)" }}>{prefs.audio_speed.toFixed(1)}x</span>
          </SettingRow>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
             <input type="range" className="aether-slider" min="0.5" max="2" step="0.5" value={prefs.audio_speed} onChange={(e) => updatePref("audio_speed", parseFloat(e.target.value))} style={{ width: "100%" }} />
             <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 4px", marginTop: "8px" }}>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>0.5x</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)", paddingLeft: "5%" }}>1.0x</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)", paddingRight: "5%" }}>1.5x</span>
               <span style={{ fontSize: "0.625rem", color: "var(--color-secondary-text)", fontFamily: "var(--font-label)" }}>2.0x</span>
             </div>
          </div>

          <div style={{ marginTop: "3rem" }}>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "1rem",
                borderRadius: "16px",
                border: "none",
                background: "rgba(225, 29, 72, 0.1)",
                color: "#FB7185",
                fontFamily: "var(--font-headline)",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "opacity 120ms ease"
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper Components ── */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      paddingTop: "1.5rem", paddingBottom: "0.5rem",
      borderBottom: "1px solid rgba(255, 255, 255, 0)",
    }}>
      <span style={{ fontFamily: "var(--font-headline)", fontSize: "0.875rem", color: "var(--color-on-surface-variant)" }}>{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: "2px",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderRadius: "99px",
      padding: "4px",
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "0.375rem 1rem",
            borderRadius: "99px",
            border: "none",
            cursor: "pointer",
            backgroundColor: selected === opt.value
              ? "var(--color-primary)"
              : "transparent",
            color: selected === opt.value
              ? "var(--color-on-primary)"
              : "var(--color-secondary-text)",
            fontFamily: "var(--font-label)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
            transition: "all 200ms ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
