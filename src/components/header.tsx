"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ShoppingCart, Zap } from "lucide-react";
import { useShop } from "@/lib/shop-context";

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
