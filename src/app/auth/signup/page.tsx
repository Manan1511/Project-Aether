"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Trigger fires to create user_preferences + user_stats
    router.push("/onboarding");
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
          Create your account
        </p>

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="signup-email"
              className="text-label-md"
              style={{ display: "block", marginBottom: "0.5rem", color: "var(--color-on-surface-variant)" }}
            >
              Email
            </label>
            <input
              id="signup-email"
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
              htmlFor="signup-password"
              className="text-label-md"
              style={{ display: "block", marginBottom: "0.5rem", color: "var(--color-on-surface-variant)" }}
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className="aether-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
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
            {loading ? "Creating account…" : "Create account"}
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
          Already have an account?{" "}
          <a
            href="/auth/login"
            style={{
              color: "var(--color-primary-bright)",
              textDecoration: "none",
            }}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
