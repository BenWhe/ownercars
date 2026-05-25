"use client";

import { createClient, resetSupabaseClient } from "@/lib/supabase/client";

function clearSupabaseAuthStorage() {
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (key.startsWith("sb-") && key.includes("auth-token")) {
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

    if (!name || !name.startsWith("sb-") || !name.includes("auth-token")) {
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

  await supabase.auth.signOut();
  await supabase.auth.signOut({ scope: "local" });
  clearSupabaseAuthStorage();
  clearSupabaseAuthCookies();
  resetSupabaseClient();
  window.dispatchEvent(new Event("ownercars:auth-changed"));
}
