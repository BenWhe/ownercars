"use client";

import { useEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isProtectedPath } from "@/lib/auth/routes";

function currentPathWithSearch() {
  return `${window.location.pathname}${window.location.search}`;
}

function clearSupabaseAuthStorage() {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (key.startsWith("sb-") && key.includes("auth-token")) {
        storage.removeItem(key);
      }
    });
  });
}

function redirectToLogin() {
  const params = new URLSearchParams({
    next: currentPathWithSearch(),
    reason: "session_expired",
  });
  window.location.replace(`/login?${params.toString()}`);
}

export default function AuthSessionSync() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function verifyProtectedPage() {
      if (!isProtectedPath(window.location.pathname)) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled && !user) {
        clearSupabaseAuthStorage();
        redirectToLogin();
      }
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        verifyProtectedPage();
      }
    };

    const handleFocus = () => {
      verifyProtectedPage();
    };

    verifyProtectedPage();
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      window.dispatchEvent(new Event("ownercars:auth-changed"));

      if (event === "SIGNED_OUT" || !session) {
        clearSupabaseAuthStorage();
        if (isProtectedPath(window.location.pathname)) {
          redirectToLogin();
        }
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
