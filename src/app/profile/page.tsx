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

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [email, setEmail] = useState("");
  const [showSettings, setShowSettings] = useState(false);
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
    if (field === "letter_spacing") html.classList.toggle("spacing-wide", value === "wide");
  }, [supabase]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }, [supabase, router]);

  if (loading) return <ProfileLoading />;

  return (
    <div style={{
      maxWidth: "600px", margin: "0 auto", padding: "2rem",
      minHeight: "calc(100dvh - 5rem)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "2rem",
      }}>
        <h1 className="text-headline-md">Profile</h1>
        <button
          id="settings-toggle"
          className="btn-tertiary"
          onClick={() => setShowSettings(!showSettings)}
          style={{ fontSize: "1.25rem" }}
        >
          ⚙
        </button>
      </div>

      {/* User info */}
      <div className="aether-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          backgroundColor: "var(--color-primary-container)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "1rem",
          fontFamily: "var(--font-headline)", fontSize: "1.25rem",
          fontWeight: 600, color: "var(--color-primary)",
        }}>
          {email.charAt(0).toUpperCase()}
        </div>
        <p className="text-body-lg" style={{ fontWeight: 500 }}>{email}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem",
          marginBottom: "1.5rem",
        }}>
          <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <div style={{
              fontFamily: "var(--font-headline)", fontSize: "1.75rem",
              fontWeight: 700, color: "var(--color-primary-bright)",
            }}>
              {stats.concepts_covered}
            </div>
            <div className="text-label-md" style={{
              color: "var(--color-on-surface-variant)", marginTop: "0.25rem",
            }}>
              Concepts
            </div>
          </div>

          <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <div style={{
              fontFamily: "var(--font-headline)", fontSize: "1.75rem",
              fontWeight: 700, color: "var(--color-primary-bright)",
            }}>
              {formatTime(stats.total_session_seconds)}
            </div>
            <div className="text-label-md" style={{
              color: "var(--color-on-surface-variant)", marginTop: "0.25rem",
            }}>
              Time with Aether
            </div>
          </div>

          <div className="aether-card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <div style={{
              fontFamily: "var(--font-headline)", fontSize: "1.75rem",
              fontWeight: 700, color: "var(--color-primary-bright)",
            }}>
              {stats.documents_studied}
            </div>
            <div className="text-label-md" style={{
              color: "var(--color-on-surface-variant)", marginTop: "0.25rem",
            }}>
              Documents
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && prefs && (
        <div style={{
          opacity: showSettings ? 1 : 0,
          transition: "opacity 120ms ease",
        }}>
          <h2 className="text-title-lg" style={{ marginBottom: "1.25rem" }}>Settings</h2>

          {/* Theme */}
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

          {/* Font */}
          <SettingRow label="Font">
            <SegmentedControl
              options={[
                { label: "Lexend", value: "inter" },
                { label: "OpenDyslexic", value: "opendyslexic" },
              ]}
              selected={prefs.font}
              onChange={(v) => updatePref("font", v)}
            />
          </SettingRow>

          {/* Spacing */}
          <SettingRow label="Letter spacing">
            <SegmentedControl
              options={[
                { label: "Normal", value: "normal" },
                { label: "Wide", value: "wide" },
              ]}
              selected={prefs.letter_spacing}
              onChange={(v) => updatePref("letter_spacing", v)}
            />
          </SettingRow>

          {/* Session length */}
          <SettingRow label="Session length">
            <SegmentedControl
              options={[
                { label: "5", value: "5" },
                { label: "7", value: "7" },
                { label: "10", value: "10" },
                { label: "15", value: "15" },
              ]}
              selected={String(prefs.session_length)}
              onChange={(v) => updatePref("session_length", parseInt(v))}
            />
          </SettingRow>

          {/* Audio default */}
          <SettingRow label="Read aloud">
            <SegmentedControl
              options={[
                { label: "Always", value: "always" },
                { label: "Sometimes", value: "sometimes" },
                { label: "Never", value: "never" },
              ]}
              selected={prefs.read_aloud_default}
              onChange={(v) => updatePref("read_aloud_default", v)}
            />
          </SettingRow>

          {/* Audio speed */}
          <SettingRow label="Audio speed">
            <SegmentedControl
              options={[
                { label: "0.75×", value: "0.75" },
                { label: "1×", value: "1" },
                { label: "1.25×", value: "1.25" },
              ]}
              selected={String(prefs.audio_speed)}
              onChange={(v) => updatePref("audio_speed", parseFloat(v))}
            />
          </SettingRow>

          <div style={{ marginTop: "2rem" }}>
            <button
              className="btn-secondary"
              onClick={handleLogout}
              style={{ width: "100%", color: "var(--color-error)" }}
            >
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
      padding: "1rem 0",
      borderBottom: "1px solid rgba(72, 72, 72, 0.15)",
    }}>
      <span className="text-body-lg" style={{ fontWeight: 500 }}>{label}</span>
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
      display: "flex", gap: "4px",
      backgroundColor: "var(--color-surface-container)",
      borderRadius: "var(--radius-input)",
      padding: "3px",
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            backgroundColor: selected === opt.value
              ? "var(--color-primary)"
              : "transparent",
            color: selected === opt.value
              ? "var(--color-on-primary)"
              : "var(--color-on-surface-variant)",
            fontFamily: "var(--font-label)",
            fontSize: "0.75rem",
            fontWeight: 600,
            transition: "all 120ms ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
