"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Brain, ArrowLeftRight, Database, Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "../lib/i18n";
import { cn } from "../lib/utils";

const NAV_KEYS = [
  { href: "/search", key: "nav.search" as const, icon: Search },
  { href: "/classify", key: "nav.classify" as const, icon: Brain },
  { href: "/compare", key: "nav.compare" as const, icon: ArrowLeftRight },
  { href: "/database/CN", key: "nav.database" as const, icon: Database },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  const NAV = NAV_KEYS.map((n) => ({ ...n, label: t(n.key) }));

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        backgroundColor: "color-mix(in srgb, var(--bg) 72%, transparent)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
        transition: "background-color 0.2s, border-color 0.2s",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 2, textDecoration: "none" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>TradeCode</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>Pro</span>
      </Link>

      <nav
        style={{ display: "flex", alignItems: "center", gap: 4 }}
        className="desktop-nav"
        aria-label="Primary"
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "btn-ghost",
              pathname === href || pathname.startsWith(href + "/")
                ? "!bg-[var(--accent-light)] !text-[var(--accent)]"
                : ""
            )}
            style={{ padding: "8px 14px", fontSize: 13, borderRadius: "var(--radius-sm)" }}
          >
            <Icon style={{ width: 16, height: 16 }} />
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="desktop-nav">
          <LanguageSwitcher />
        </div>
        <ThemeToggle />
        <button
          onClick={() => setOpen(!open)}
          className="mobile-menu-btn"
          aria-label="Toggle menu"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            top: 64,
            left: 0,
            right: 0,
            backgroundColor: "color-mix(in srgb, var(--bg) 92%, transparent)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid var(--border)",
            padding: "12px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            animation: "slideUp 0.2s ease-out",
          }}
        >
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "btn-ghost",
                pathname === href || pathname.startsWith(href + "/")
                  ? "!bg-[var(--accent-light)] !text-[var(--accent)]"
                  : ""
              )}
              style={{ padding: "10px 14px", fontSize: 14, borderRadius: "var(--radius-sm)", width: "100%" }}
            >
              <Icon style={{ width: 18, height: 18 }} />
              {label}
            </Link>
          ))}
          <div style={{ padding: "8px 0", borderTop: "1px solid var(--border)", marginTop: 4 }}>
            <LanguageSwitcher />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </header>
  );
}
