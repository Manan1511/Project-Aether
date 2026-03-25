"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Applies saved user preferences to the <html> element.
 * Only fetches ONCE per session. Also handles onboarding redirect.
 */
export default function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const hasFetched = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hasFetched.current) {
      setLoaded(true);
      return;
    }

    async function loadPreferences() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        hasFetched.current = true;
        setLoaded(true);
        return;
      }

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("theme, font, letter_spacing, onboarding_complete")
        .eq("user_id", session.user.id)
        .single();

      if (prefs) {
        // Check onboarding — redirect if not complete
        if (
          !prefs.onboarding_complete &&
          !pathname.startsWith("/onboarding") &&
          !pathname.startsWith("/auth")
        ) {
          router.replace("/onboarding");
          hasFetched.current = true;
          setLoaded(true);
          return;
        }

        const html = document.documentElement;
        html.classList.toggle("theme-light", prefs.theme === "light");
        html.classList.toggle("font-dyslexic", prefs.font === "opendyslexic");
        html.classList.toggle("spacing-wide", prefs.letter_spacing === "wide");
      }

      hasFetched.current = true;
      setLoaded(true);
    }

    loadPreferences();
  }, [pathname, router]);

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: "opacity 120ms ease" }}>
      {children}
    </div>
  );
}
