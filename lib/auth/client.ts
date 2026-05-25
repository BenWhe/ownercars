"use client";

import { createClient, resetSupabaseClient } from "@/lib/supabase/client";

function isSupabaseAuthKey(key: string) {
  return key.startsWith("sb-");
}

function clearSupabaseAuthStorage() {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (isSupabaseAuthKey(key)) {
        storage.removeItem(key);
      }
    });
  });
}

function clearSupabaseAuthCookies() {
  const hostname = window.location.hostname;
  const domainParts = hostname.split(".");
  const cookieDomains = new Set<string>([hostname]);

  if (domainParts.length > 2) {
    cookieDomains.add(`.${domainParts.slice(-2).join(".")}`);
  }

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();

    if (!name || !name.startsWith("sb-")) {
      return;
    }

    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    cookieDomains.forEach((domain) => {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
    });
  });
}

export async function signOutAndClearSession() {
  const supabase = createClient();

  // Do not block the UI on Supabase's network sign-out. The server route below
  // is the source of truth for clearing auth cookies, and local storage is
  // cleared synchronously before navigating away.
  void supabase.auth.signOut({ scope: "local" }).catch(() => null);
  clearSupabaseAuthStorage();
  clearSupabaseAuthCookies();
  resetSupabaseClient();
  window.dispatchEvent(new Event("ownercars:auth-changed"));
  window.location.replace("/auth/sign-out");
}
