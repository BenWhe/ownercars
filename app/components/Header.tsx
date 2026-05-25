"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { signOutAndClearSession } from "@/lib/auth/client";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function fetchUnreadCount() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    const conversationIds =
      conversations?.map((conversation: { id: string }) => conversation.id) || [];

    if (conversationIds.length === 0) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .is("read_at", null);

    setUnreadCount(count || 0);
  }

  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(!!user);

      if (user) {
        await fetchUnreadCount();
      } else {
        setUnreadCount(0);
      }
    }

    function handleMessagesRead() {
      fetchUnreadCount();
    }

    checkSession();

    window.addEventListener("ownercars:messages-read", handleMessagesRead);
    window.addEventListener("ownercars:auth-changed", checkSession);
    window.addEventListener("focus", checkSession);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      setLoggedIn(!!session);

      if (session) {
        await fetchUnreadCount();
      } else {
        setUnreadCount(0);
      }
    });

    const channel = supabase
      .channel("header-message-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("ownercars:messages-read", handleMessagesRead);
      window.removeEventListener("ownercars:auth-changed", checkSession);
      window.removeEventListener("focus", checkSession);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleMenuClick() {
    const nextState = !menuOpen;
    setMenuOpen(nextState);

    if (nextState && loggedIn) {
      await fetchUnreadCount();
    }
  }

  async function handleLogout() {
    setLoggedIn(false);
    setUnreadCount(0);
    setMenuOpen(false);
    await signOutAndClearSession();
  }

  return (
    <header className="site-header">
      <Link href="/" className="site-logo" onClick={() => setMenuOpen(false)}>
        OwnerCars<span>.co.uk</span>
      </Link>

      <nav className="site-nav">
        <Link href="/browse">Browse cars</Link>

        <Link href="/create-advert" className="nav-cta">
          Advertise
        </Link>

        <button
          className={menuOpen ? "nav-menu-button active" : "nav-menu-button"}
          onClick={handleMenuClick}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "Close" : "Menu"}
          {loggedIn && unreadCount > 0 && (
            <span className="nav-unread-dot">{unreadCount}</span>
          )}
        </button>
      </nav>

      {menuOpen && (
        <div className="apple-menu">
          <div className="apple-menu-inner">
            <div className="apple-menu-column">
              <p className="apple-menu-label">OwnerCars</p>
              <Link href="/browse" onClick={() => setMenuOpen(false)}>
                Browse cars
              </Link>
              <Link href="/create-advert" onClick={() => setMenuOpen(false)}>
                Start an advert
              </Link>
              <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>
                How it works
              </Link>
            </div>

            <div className="apple-menu-column">
              <p className="apple-menu-label">Protection</p>
              <Link href="/seller-protection" onClick={() => setMenuOpen(false)}>
                Seller protection
              </Link>
              <Link href="/safety-advice" onClick={() => setMenuOpen(false)}>
                Safety advice
              </Link>
              <Link href="/contact" onClick={() => setMenuOpen(false)}>
                Contact
              </Link>
            </div>

            <div className="apple-menu-column">
              <p className="apple-menu-label">Account</p>

              {loggedIn ? (
                <>
                  <Link href="/messages" onClick={() => setMenuOpen(false)}>
                    Messages
                    {unreadCount > 0 && (
                      <span className="menu-unread-badge">{unreadCount}</span>
                    )}
                  </Link>

                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    className="apple-menu-logout"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Login
                  </Link>

                  <Link href="/create-account" onClick={() => setMenuOpen(false)}>
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}