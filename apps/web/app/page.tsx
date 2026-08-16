"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, Brain, ArrowLeftRight, ArrowUpDown, Ship, Plane } from "lucide-react";
import { useTranslation } from "../lib/i18n";

type Port = { code: string; name: string; city: string; country: "CN" | "IN" | "AE"; mode: "sea" | "air" | "both" };

const ALL_PORTS: Port[] = [
  // Sea ports
  { code: "CNSHA", name: "Shanghai", city: "Shanghai", country: "CN", mode: "sea" },
  { code: "CNYTN", name: "Yantian (Shenzhen)", city: "Shenzhen", country: "CN", mode: "sea" },
  { code: "CNGZH", name: "Nansha (Guangzhou)", city: "Guangzhou", country: "CN", mode: "sea" },
  { code: "CNNBO", name: "Ningbo", city: "Ningbo", country: "CN", mode: "sea" },
  { code: "CNTXG", name: "Tianjin", city: "Tianjin", country: "CN", mode: "sea" },
  { code: "CNTAO", name: "Qingdao", city: "Qingdao", country: "CN", mode: "sea" },
  { code: "CNXMN", name: "Xiamen", city: "Xiamen", country: "CN", mode: "sea" },
  { code: "CNDLC", name: "Dalian", city: "Dalian", country: "CN", mode: "sea" },
  { code: "INNSA", name: "JNPT (Mumbai)", city: "Mumbai", country: "IN", mode: "sea" },
  { code: "INMUN", name: "Mundra", city: "Mundra", country: "IN", mode: "sea" },
  { code: "INMAA", name: "Chennai", city: "Chennai", country: "IN", mode: "sea" },
  { code: "INCCU", name: "Kolkata", city: "Kolkata", country: "IN", mode: "sea" },
  { code: "INCOK", name: "Cochin", city: "Cochin", country: "IN", mode: "sea" },
  { code: "INHAZ", name: "Hazira", city: "Hazira", country: "IN", mode: "sea" },
  { code: "INPAV", name: "Pipavav", city: "Pipavav", country: "IN", mode: "sea" },
  { code: "INTUT", name: "Tuticorin", city: "Tuticorin", country: "IN", mode: "sea" },
  { code: "AEJEA", name: "Jebel Ali (Dubai)", city: "Dubai", country: "AE", mode: "sea" },
  { code: "AEAUH", name: "Khalifa Port (Abu Dhabi)", city: "Abu Dhabi", country: "AE", mode: "sea" },
  { code: "AESHJ", name: "Sharjah", city: "Sharjah", country: "AE", mode: "sea" },
  // Air ports
  { code: "PVG", name: "Shanghai Pudong", city: "Shanghai", country: "CN", mode: "air" },
  { code: "PEK", name: "Beijing Capital", city: "Beijing", country: "CN", mode: "air" },
  { code: "CAN", name: "Guangzhou Baiyun", city: "Guangzhou", country: "CN", mode: "air" },
  { code: "SZX", name: "Shenzhen Bao'an", city: "Shenzhen", country: "CN", mode: "air" },
  { code: "BOM", name: "Mumbai", city: "Mumbai", country: "IN", mode: "air" },
  { code: "DEL", name: "Delhi", city: "Delhi", country: "IN", mode: "air" },
  { code: "MAA", name: "Chennai", city: "Chennai", country: "IN", mode: "air" },
  { code: "BLR", name: "Bangalore", city: "Bangalore", country: "IN", mode: "air" },
  { code: "HYD", name: "Hyderabad", city: "Hyderabad", country: "IN", mode: "air" },
  { code: "DXB", name: "Dubai", city: "Dubai", country: "AE", mode: "air" },
  { code: "AUH", name: "Abu Dhabi", city: "Abu Dhabi", country: "AE", mode: "air" },
  { code: "SHJ", name: "Sharjah", city: "Sharjah", country: "AE", mode: "air" },
];

const FLAGS: Record<string, string> = { CN: "\uD83C\uDDE8\uD83C\uDDF3", IN: "\uD83C\uDDEE\uD83C\uDDF3", AE: "\uD83C\uDDE6\uD83C\uDDEA" };
const GROUP_LABELS: Record<string, Record<string, string>> = {
  en: { CN: "China", IN: "India", AE: "UAE" },
  zh: { CN: "\u4E2D\u56FD", IN: "\u5370\u5EA6", AE: "\u963F\u8054\u914B" },
  hi: { CN: "China", IN: "India", AE: "UAE" },
};

const FEATURE_KEYS = [
  { href: "/search", icon: Search, titleKey: "home.feature.search.title" as const, descKey: "home.feature.search.desc" as const },
  { href: "/classify", icon: Brain, titleKey: "home.feature.classify.title" as const, descKey: "home.feature.classify.desc" as const },
  { href: "/compare", icon: ArrowLeftRight, titleKey: "home.feature.compare.title" as const, descKey: "home.feature.compare.desc" as const },
] as const;

function PortDropdown({ label, selected, excludedCountry, mode, onSelect, placeholder }: {
  label: string;
  selected: Port | null;
  excludedCountry?: string;
  mode: "sea" | "air";
  onSelect: (p: Port) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { locale, t } = useTranslation();

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = ALL_PORTS.filter(p => {
    if (p.mode !== mode && p.mode !== "both") return false;
    if (excludedCountry && p.country === excludedCountry) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  const groups = new Map<string, Port[]>();
  for (const p of filtered) { const g = groups.get(p.country) ?? []; g.push(p); groups.set(p.country, g); }

  return (
    <div ref={ref} style={{ flex: 1, position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 16px", textAlign: "left", fontSize: 15, fontWeight: 600,
          borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg-input)",
          color: selected ? "var(--text)" : "var(--text-muted)", cursor: "pointer", transition: "border-color 0.15s",
          display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{selected.code} — {selected.city}</span>
          </>
        ) : (
          <span>{placeholder}</span>
        )}
      </button>
      {open && (
        <div
          className="glass-elevated"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, marginTop: 4,
            borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: 8,
            maxHeight: 320, overflowY: "auto",
          }}
        >
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("route.search.placeholder")}
            autoFocus
            style={{ width: "100%", padding: "8px 12px", fontSize: 13, boxSizing: "border-box", marginBottom: 6 }}
          />
          {filtered.length === 0 && <div style={{ padding: "12px 8px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{t("route.no.results")}</div>}
          {Array.from(groups.entries()).map(([country, ports]) => (
            <div key={country}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "6px 8px 4px", letterSpacing: "0.04em" }}>
                {FLAGS[country] ?? ""} {GROUP_LABELS[locale]?.[country] ?? GROUP_LABELS.en[country] ?? country}
              </div>
              {ports.map(p => (
                <button
                  key={p.code}
                  onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 8px",
                    fontSize: 13, borderRadius: "var(--radius-sm)", border: "none", background: "transparent",
                    cursor: "pointer", color: "var(--text)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 6, fontFamily: "monospace", fontSize: 12 }}>{p.code}</span>
                  <span style={{ color: "var(--text-faint)", marginLeft: 4, fontSize: 12 }}>{p.city}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [fromPort, setFromPort] = useState<Port | null>(null);
  const [toPort, setToPort] = useState<Port | null>(null);
  const [mode, setMode] = useState<"sea" | "air">("sea");
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { t } = useTranslation();

  function swapPorts() { setFromPort(toPort); setToPort(fromPort); }

  function handleStart() {
    if (!fromPort || !toPort) return;
    sessionStorage.setItem("traderoute", JSON.stringify({
      fromPort: { code: fromPort.code, name: fromPort.name, city: fromPort.city, country: fromPort.country },
      toPort: { code: toPort.code, name: toPort.name, city: toPort.city, country: toPort.country },
      mode,
      startedAt: new Date().toISOString(),
    }));
    router.push("/workflow");
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="page-shell" style={{ paddingBottom: 80 }}>
      {/* Port selector hero */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, paddingBottom: 48, animation: "fadeIn 0.5s ease-out" }}>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--text)", margin: 0, textAlign: "center" }}>
          {t("route.title")}
        </h1>
        <p style={{ marginTop: 12, fontSize: "clamp(14px, 2vw, 17px)", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6, textAlign: "center" }}>
          {t("route.subtitle")}
        </p>

        {/* Selector card */}
        <div
          className="card"
          style={{
            marginTop: 32, width: "100%", maxWidth: 640, padding: 24,
            display: "flex", flexDirection: "column", gap: 16,
          }}
        >
          {/* FROM / swap / TO */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <PortDropdown
              label={t("route.from")}
              selected={fromPort}
              excludedCountry={toPort?.country}
              mode={mode}
              onSelect={setFromPort}
              placeholder={t("route.select.origin")}
            />
            <button
              onClick={swapPorts}
              title={t("route.swap")}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--border)",
                background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, marginBottom: 2, color: "var(--accent)",
              }}
            >
              <ArrowUpDown style={{ width: 16, height: 16 }} />
            </button>
            <PortDropdown
              label={t("route.to")}
              selected={toPort}
              excludedCountry={fromPort?.country}
              mode={mode}
              onSelect={setToPort}
              placeholder={t("route.select.destination")}
            />
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { value: "sea" as const, icon: Ship, key: "route.sea" as const },
              { value: "air" as const, icon: Plane, key: "route.air" as const },
            ].map(({ value, icon: Icon, key }) => (
              <button
                key={value}
                onClick={() => { setMode(value); setFromPort(null); setToPort(null); }}
                style={{
                  flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${mode === value ? "var(--accent)" : "var(--border)"}`,
                  background: mode === value ? "var(--accent-light)" : "var(--bg-input)",
                  color: mode === value ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <Icon style={{ width: 15, height: 15 }} /> {t(key)}
              </button>
            ))}
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={!fromPort || !toPort}
            className="btn-primary"
            style={{
              width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: "var(--radius)",
              opacity: !fromPort || !toPort ? 0.5 : 1, cursor: !fromPort || !toPort ? "not-allowed" : "pointer",
            }}
          >
            {t("route.start")}
          </button>
        </div>
      </section>

      {/* Existing search bar */}
      <section style={{ marginTop: 8 }}>
        <form onSubmit={handleSearchSubmit} style={{ width: "100%", maxWidth: 520, position: "relative", margin: "0 auto" }}>
          <Search style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("home.search.placeholder")} style={{ paddingLeft: 46, paddingRight: 110, height: 52, fontSize: 16, borderRadius: "var(--radius)", width: "100%", boxSizing: "border-box" }} />
          <button type="submit" className="btn-primary" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", height: 40, padding: "0 20px", borderRadius: "var(--radius-sm)" }}>
            {t("home.search.btn")}
          </button>
        </form>
      </section>

      {/* Feature cards */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 32 }}>
        {FEATURE_KEYS.map(({ href, icon: Icon, titleKey, descKey }, i) => (
          <Link key={href} href={href} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 28, textDecoration: "none", animationDelay: `${i * 80}ms`, animation: "slideUp 0.4s ease-out both" }}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", backgroundColor: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ width: 22, height: 22, color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{t(titleKey)}</div>
              <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>{t(descKey)}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Stats */}
      <section style={{ display: "flex", justifyContent: "center", gap: 48, marginTop: 64, padding: "32px 0", borderTop: "1px solid var(--border)", animation: "fadeIn 0.6s ease-out 0.3s both" }}>
        {[
          { value: "35,000+", labelKey: "home.stat.codes" as const },
          { value: "3", labelKey: "home.stat.countries" as const },
          { value: "Free & open", labelKey: "" as const },
        ].map(({ value, labelKey }) => (
          <div key={value} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
            {labelKey && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{t(labelKey)}</div>}
          </div>
        ))}
      </section>
    </main>
  );
}
