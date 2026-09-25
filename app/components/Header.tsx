"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOutAndClearSession } from "@/lib/auth/client";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function fetchUnreadCount() {
    const res = await fetch("/api/messages/unread");
    const result = await res.json();

    if (res.ok) {
      setUnreadCount(result.unreadCount || 0);
    }
  }

  useEffect(() => {
    async function checkSession() {
      const res = await fetch("/api/account");
      const result = await res.json();
      const user = result.user;
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

    return () => {
      window.removeEventListener("ownercars:messages-read", handleMessagesRead);
      window.removeEventListener("ownercars:auth-changed", checkSession);
      window.removeEventListener("focus", checkSession);
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
      <div className="site-brand">
        <Link href="/" className="site-logo" onClick={() => setMenuOpen(false)}>
          OwnerCars<span>.co.uk</span>
        </Link>
        <p className="site-tagline">Free to list. Private by design.</p>
      </div>

      <nav className="site-nav">
        <Link href="/browse" className="mk-nav-link">Buy a car</Link>
        <Link href="/car-selling-scams" className="mk-nav-link">Scam advice</Link>
        <Link href="/how-it-works" className="mk-nav-link">How it works</Link>

        <Link href="/create-advert" className="nav-cta">
          {LAUNCH_FREE_LISTING ? "Sell your car free" : "Sell your car"}
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
                Buy a car
              </Link>
              <Link href="/create-advert" onClick={() => setMenuOpen(false)}>
                Sell your car
              </Link>
              <Link href="/car-selling-scams" onClick={() => setMenuOpen(false)}>
                Scam advice
              </Link>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>
                How it works
              </Link>
              <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                Pricing
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

                  <Link href="/account" onClick={() => setMenuOpen(false)}>
                    Account
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