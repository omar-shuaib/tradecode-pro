"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Brain, ArrowLeftRight } from "lucide-react";
import { useTranslation } from "../lib/i18n";

const FEATURE_KEYS = [
  { href: "/search", icon: Search, titleKey: "home.feature.search.title" as const, descKey: "home.feature.search.desc" as const },
  { href: "/classify", icon: Brain, titleKey: "home.feature.classify.title" as const, descKey: "home.feature.classify.desc" as const },
  { href: "/compare", icon: ArrowLeftRight, titleKey: "home.feature.compare.title" as const, descKey: "home.feature.compare.desc" as const },
] as const;

export default function Home() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { t } = useTranslation();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="page-shell" style={{ paddingBottom: 80 }}>
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          paddingTop: 80,
          paddingBottom: 48,
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          {t("home.hero")}
        </h1>
        <p
          style={{
            marginTop: 16,
            fontSize: "clamp(15px, 2vw, 18px)",
            color: "var(--text-secondary)",
            maxWidth: 560,
            lineHeight: 1.6,
          }}
        >
          {t("home.subtitle")}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 36,
            width: "100%",
            maxWidth: 520,
            position: "relative",
          }}
        >
          <Search
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.search.placeholder")}
            style={{
              paddingLeft: 46,
              paddingRight: 110,
              height: 52,
              fontSize: 16,
              borderRadius: "var(--radius)",
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              height: 40,
              padding: "0 20px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {t("home.search.btn")}
          </button>
        </form>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginTop: 16,
        }}
      >
        {FEATURE_KEYS.map(({ href, icon: Icon, titleKey, descKey }, i) => (
          <Link
            key={href}
            href={href}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: 28,
              textDecoration: "none",
              animationDelay: `${i * 80}ms`,
              animation: "slideUp 0.4s ease-out both",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon style={{ width: 22, height: 22, color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{t(titleKey)}</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                {t(descKey)}
              </p>
            </div>
          </Link>
        ))}
      </section>

      <section
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 48,
          marginTop: 64,
          padding: "32px 0",
          borderTop: "1px solid var(--border)",
          animation: "fadeIn 0.6s ease-out 0.3s both",
        }}
      >
        {[
          { value: "25,000+", labelKey: "home.stat.codes" as const },
          { value: "2", labelKey: "home.stat.countries" as const },
          { value: "Free & open", labelKey: "" as const },
        ].map(({ value, labelKey }) => (
          <div key={value} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
            {labelKey && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{t(labelKey)}</div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
