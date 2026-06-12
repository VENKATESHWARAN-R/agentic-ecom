"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, ShoppingCart, User, Zap } from "lucide-react";
import { useShop } from "@/lib/shop-context";
import { personaOrder, userProfiles } from "@/lib/users";
import type { PersonaId } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PersonaMenu() {
  const { personaId, activeUser, setActiveUser } = useShop();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const choose = (id: PersonaId) => {
    setActiveUser(id);
    setOpen(false);
  };

  return (
    <div className="persona-menu" ref={ref}>
      <button
        type="button"
        className="persona-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="persona-avatar" aria-hidden>
          {activeUser ? initials(activeUser.name) : <User size={16} />}
        </span>
        <span className="persona-trigger-label">{activeUser ? activeUser.name.split(" ")[0] : "Sign in"}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="persona-dropdown" role="menu">
          <div className="persona-dropdown-head">Switch demo account</div>
          {personaOrder.map((id) => {
            const profile = userProfiles[id];
            return (
              <button key={id} type="button" className="persona-option" role="menuitemradio" aria-checked={personaId === id} onClick={() => choose(id)}>
                <span className="persona-avatar sm" aria-hidden>
                  {initials(profile.name)}
                </span>
                <span className="persona-option-text">
                  <span className="persona-option-name">{profile.name}</span>
                  <span className="persona-option-label">{profile.personaLabel}</span>
                </span>
                {personaId === id && <Check size={15} className="persona-check" />}
              </button>
            );
          })}
          <button type="button" className="persona-option" role="menuitemradio" aria-checked={personaId === "guest"} onClick={() => choose("guest")}>
            <span className="persona-avatar sm guest" aria-hidden>
              <User size={14} />
            </span>
            <span className="persona-option-text">
              <span className="persona-option-name">Continue as guest</span>
              <span className="persona-option-label">Signed out · manual checkout</span>
            </span>
            {personaId === "guest" && <Check size={15} className="persona-check" />}
          </button>
          {activeUser && (
            <Link href="/account" className="persona-account-link" role="menuitem" onClick={() => setOpen(false)}>
              My account
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const NAV_LINKS: { href: string; label: string; className?: string }[] = [
  { href: "/deals", label: "Deals", className: "deals-link" },
  { href: "/c/phones", label: "Phones" },
  { href: "/c/laptops", label: "Laptops" },
  { href: "/c/desktops", label: "Desktop PCs" },
  { href: "/c/components", label: "PC Components" },
  { href: "/c/monitors", label: "Monitors" },
  { href: "/c/audio", label: "Audio" },
  { href: "/c/accessories", label: "Accessories" },
  { href: "/c/smart-home", label: "Smart Home" },
];

export function SiteHeader() {
  const { cartCount } = useShop();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">
            <Zap size={17} fill="currentColor" />
          </span>
          Voltti
        </Link>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          }}
        >
          <span className="search-icon">
            <Search size={16} />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search phones, GPUs, headphones…"
            aria-label="Search the catalog"
          />
        </form>
        <div className="header-actions">
          <PersonaMenu />
          <Link href="/cart" className="cart-button">
            <ShoppingCart size={17} />
            Cart
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </Link>
        </div>
      </div>
      <nav className="container nav-row" aria-label="Categories">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${link.className ?? ""} ${pathname === link.href ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span>
          <strong>Voltti</strong> — agentic electronics store demo. No real orders, payments, or inventory.
        </span>
        <span>Built with Next.js + CopilotKit · Proof of concept</span>
      </div>
    </footer>
  );
}
