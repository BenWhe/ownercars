"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { LAUNCH_FREE_LISTING } from "@/lib/payments/config";
import { buildMakeOptions } from "@/lib/vehicles/makes";
import { PRICE_OPTIONS } from "@/lib/vehicles/filters";

// Sellers are the priority until there are about 30 listings; set this to
// "buy" to make Buy the default tab.
const HERO_DEFAULT_TAB: "buy" | "sell" = "sell";

type Tab = "buy" | "sell";

export default function HeroSearch({ liveMakes = [] }: { liveMakes?: string[] }) {
  const router = useRouter();
  const uid = useId();
  const [tab, setTab] = useState<Tab>(HERO_DEFAULT_TAB);
  const buyTabRef = useRef<HTMLButtonElement>(null);
  const sellTabRef = useRef<HTMLButtonElement>(null);

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");
  const [reg, setReg] = useState("");

  const makeOptions = buildMakeOptions(liveMakes);

  function handleTabKeys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = tab === "buy" ? "sell" : "buy";
    setTab(next);
    (next === "buy" ? buyTabRef : sellTabRef).current?.focus();
  }

  function handleBuy(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (price) params.set("price", price);
    const pc = postcode.trim();
    if (pc) params.set("postcode", pc.toUpperCase());
    const qs = params.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  }

  function handleSell(e: FormEvent) {
    e.preventDefault();
    const clean = reg.replace(/\s+/g, "").toUpperCase();
    router.push(clean ? `/create-advert?reg=${encodeURIComponent(clean)}` : "/create-advert");
  }

  const ids = {
    buyTab: `${uid}-tab-buy`,
    sellTab: `${uid}-tab-sell`,
    buyPanel: `${uid}-panel-buy`,
    sellPanel: `${uid}-panel-sell`,
  };

  return (
    <div className="mk-search">
      <div className="mk-search-tabs" role="tablist" aria-label="Buy or sell a car" onKeyDown={handleTabKeys}>
        <button
          ref={buyTabRef}
          type="button"
          role="tab"
          id={ids.buyTab}
          aria-selected={tab === "buy"}
          aria-controls={ids.buyPanel}
          tabIndex={tab === "buy" ? 0 : -1}
          className="mk-search-tab"
          onClick={() => setTab("buy")}
        >
          Buy a car
        </button>
        <button
          ref={sellTabRef}
          type="button"
          role="tab"
          id={ids.sellTab}
          aria-selected={tab === "sell"}
          aria-controls={ids.sellPanel}
          tabIndex={tab === "sell" ? 0 : -1}
          className="mk-search-tab"
          onClick={() => setTab("sell")}
        >
          Sell your car
        </button>
      </div>

      <div
        role="tabpanel"
        id={ids.buyPanel}
        aria-labelledby={ids.buyTab}
        hidden={tab !== "buy"}
        className="mk-search-panel"
      >
        <form onSubmit={handleBuy} className="mk-buy-form">
          <label className="mk-field">
            <span>Make</span>
            <select value={make} onChange={(e) => setMake(e.target.value)}>
              <option value="">Any make</option>
              {makeOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="mk-field">
            <span>Price</span>
            <select value={price} onChange={(e) => setPrice(e.target.value)}>
              {PRICE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="mk-field">
            <span>Postcode (optional)</span>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Your postcode"
              maxLength={8}
              autoComplete="postal-code"
            />
          </label>
          <button type="submit" className="mk-btn mk-btn-primary mk-buy-submit">
            Search cars
          </button>
        </form>
      </div>

      <div
        role="tabpanel"
        id={ids.sellPanel}
        aria-labelledby={ids.sellTab}
        hidden={tab !== "sell"}
        className="mk-search-panel"
      >
        <form onSubmit={handleSell}>
          <label htmlFor={`${uid}-reg`} className="mk-field-label">
            Enter your registration
          </label>
          <div className="mk-sell-row">
            <div className="ca-reg-plate">
              <span className="ca-gb">GB</span>
              <input
                id={`${uid}-reg`}
                type="text"
                placeholder="AB12 CDE"
                value={reg}
                maxLength={8}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
            <button type="submit" className="mk-btn mk-btn-primary">
              {LAUNCH_FREE_LISTING ? "Start free advert" : "Start your advert"}
            </button>
          </div>
          <p className="mk-search-help">
            {LAUNCH_FREE_LISTING
              ? "Free to list during launch. We use your registration only to fill in your car's details."
              : "We use your registration only to fill in your car's details."}
          </p>
        </form>
      </div>
    </div>
  );
}
