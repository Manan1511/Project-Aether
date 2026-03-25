"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/library");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "2rem",
      }}
    >
      <div
        className="aether-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2.5rem",
        }}
      >
        <h1
          className="text-headline-md"
          style={{
            textAlign: "center",
            marginBottom: "0.5rem",
            color: "var(--color-on-surface)",
          }}
        >
          <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            Aether
          </span>
        </h1>
        <p
          className="text-body-lg"
          style={{
            textAlign: "center",
            color: "var(--color-on-surface-variant)",
            marginBottom: "2rem",
          }}
        >
          Welcome back
        </p>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="login-email"
              className="text-label-md"
              style={{ display: "block", marginBottom: "0.5rem", color: "var(--color-on-surface-variant)" }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className="aether-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="text-label-md"
              style={{ display: "block", marginBottom: "0.5rem", color: "var(--color-on-surface-variant)" }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="aether-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={6}
            />
          </div>

          {error && (
            <p
              style={{
                color: "var(--color-error)",
                fontSize: "0.875rem",
                fontFamily: "var(--font-body)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            color: "var(--color-on-surface-variant)",
            fontSize: "0.875rem",
            fontFamily: "var(--font-body)",
          }}
        >
          No account?{" "}
          <a
            href="/auth/signup"
            style={{
              color: "var(--color-primary-bright)",
              textDecoration: "none",
            }}
          >
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
