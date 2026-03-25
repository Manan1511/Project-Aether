"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ────────────────────────────────────────
   Onboarding Steps Configuration
   ──────────────────────────────────────── */

interface OnboardingStep {
  id: string;
  question: string;
  description: string;
  field: string;
  options: { label: string; value: string | number; description?: string }[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "session-length",
    question: "How many questions feel right for a session?",
    description: "You can change this anytime. We recommend starting shorter.",
    field: "session_length",
    options: [
      { label: "5", value: 5, description: "Quick review" },
      { label: "7", value: 7, description: "Balanced (default)" },
      { label: "10", value: 10, description: "Deeper dive" },
      { label: "15", value: 15, description: "Extended study" },
    ],
  },
  {
    id: "font",
    question: "Which font is easier to read?",
    description: "OpenDyslexic is designed to help with letter recognition.",
    field: "font",
    options: [
      { label: "Lexend", value: "inter", description: "Clean and modern" },
      { label: "OpenDyslexic", value: "opendyslexic", description: "Designed for dyslexia" },
    ],
  },
  {
    id: "audio",
    question: "Would you like questions read aloud?",
    description: "Audio can help with focus. You can always toggle per‑question.",
    field: "read_aloud_default",
    options: [
      { label: "Always", value: "always", description: "Read every question" },
      { label: "Sometimes", value: "sometimes", description: "Only when I tap" },
      { label: "Never", value: "never", description: "Text only" },
    ],
  },
  {
    id: "theme",
    question: "Light or dark?",
    description: "Both themes meet WCAG AA contrast standards.",
    field: "theme",
    options: [
      { label: "Dark", value: "dark", description: "Easier on the eyes at night" },
      { label: "Light", value: "light", description: "Better in bright environments" },
    ],
  },
];

/* ────────────────────────────────────────
   Component
   ──────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [fade, setFade] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selections, setSelections] = useState<Record<string, string | number>>({
    session_length: 7,
    font: "inter",
    read_aloud_default: "sometimes",
    theme: "dark",
  });

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleSelect = useCallback(
    (value: string | number) => {
      setSelections((prev) => ({
        ...prev,
        [step.field]: value,
      }));

      // Live‑preview theme + font
      if (step.field === "theme") {
        const html = document.documentElement;
        html.classList.toggle("theme-light", value === "light");
      }
      if (step.field === "font") {
        const html = document.documentElement;
        html.classList.toggle("font-dyslexic", value === "opendyslexic");
      }
    },
    [step.field]
  );

  const goNext = useCallback(async () => {
    if (isLastStep) {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { error } = await supabase
        .from("user_preferences")
        .update({
          ...selections,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to save preferences:", error);
        setSaving(false);
        return;
      }

      router.push("/library");
      router.refresh();
      return;
    }

    // Fade out → change step → fade in
    setFade(false);
    setTimeout(() => {
      setCurrentStep((s) => s + 1);
      setFade(true);
    }, 120);
  }, [isLastStep, selections, supabase, router]);

  const goBack = useCallback(() => {
    if (currentStep === 0) return;
    setFade(false);
    setTimeout(() => {
      setCurrentStep((s) => s - 1);
      setFade(true);
    }, 120);
  }, [currentStep]);

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
      {/* Progress dots */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "2.5rem",
        }}
      >
        {ONBOARDING_STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentStep ? "24px" : "8px",
              height: "8px",
              borderRadius: "4px",
              backgroundColor:
                i === currentStep
                  ? "var(--color-primary)"
                  : i < currentStep
                  ? "var(--color-primary-dim)"
                  : "var(--color-surface-container-high)",
              transition: "all 120ms ease",
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          opacity: fade ? 1 : 0,
          transition: "opacity 120ms ease",
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
          {step.question}
        </h1>
        <p
          className="text-body-lg"
          style={{
            textAlign: "center",
            color: "var(--color-on-surface-variant)",
            marginBottom: "2rem",
          }}
        >
          {step.description}
        </p>

        {/* Options */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {step.options.map((option) => {
            const isSelected = selections[step.field] === option.value;
            return (
              <button
                key={String(option.value)}
                id={`onboarding-${step.id}-${option.value}`}
                onClick={() => handleSelect(option.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.25rem",
                  backgroundColor: isSelected
                    ? "var(--color-primary-container)"
                    : "var(--color-surface-container)",
                  border: isSelected
                    ? "2px solid var(--color-primary)"
                    : "2px solid transparent",
                  borderRadius: "var(--radius-card)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                  textAlign: "left",
                  width: "100%",
                  fontFamily:
                    step.field === "font" && option.value === "opendyslexic"
                      ? "'OpenDyslexic', sans-serif"
                      : "var(--font-body)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 500,
                      color: isSelected
                        ? "var(--color-on-primary-container)"
                        : "var(--color-on-surface)",
                      marginBottom: "2px",
                    }}
                  >
                    {option.label}
                  </div>
                  {option.description && (
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: isSelected
                          ? "var(--color-on-primary-container)"
                          : "var(--color-on-surface-variant)",
                        opacity: 0.8,
                      }}
                    >
                      {option.description}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: isSelected
                      ? "6px solid var(--color-primary)"
                      : "2px solid var(--color-outline)",
                    transition: "all 120ms ease",
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "2.5rem",
          }}
        >
          {currentStep > 0 ? (
            <button className="btn-tertiary" onClick={goBack}>
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            className="btn-primary"
            onClick={goNext}
            disabled={saving}
            style={{ minWidth: "120px" }}
          >
            {saving
              ? "Saving…"
              : isLastStep
              ? "Start learning"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
