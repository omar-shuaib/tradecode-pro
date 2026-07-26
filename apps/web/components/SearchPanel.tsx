"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CodeResult } from "../lib/shared-types";
import { api } from "../lib/api";
import { useTranslation } from "../lib/i18n";
import { CodePopup } from "./CodePopup";
import { Search, X } from "lucide-react";

function CountryBadge({ country }: { country: string }) {
  return (
    <span
      className="badge"
      style={{
        backgroundColor: country === "CN" ? "var(--warning-light)" : "var(--success-light)",
        color: country === "CN" ? "var(--warning)" : "var(--success)",
        fontSize: 11,
        padding: "1px 8px",
      }}
    >
      {country}
    </span>
  );
}

function DutyChip({ rate }: { rate?: number | null }) {
  if (rate == null) return null;
  const high = rate >= 15;
  return (
    <span
      className="badge"
      style={{
        backgroundColor: high ? "var(--warning-light)" : "var(--accent-light)",
        color: high ? "var(--warning)" : "var(--accent)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {rate}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="skeleton" style={{ width: 60, height: 18 }} />
      <div className="skeleton" style={{ width: "80%", height: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <div className="skeleton" style={{ width: 36, height: 18 }} />
        <div className="skeleton" style={{ width: 40, height: 18 }} />
      </div>
    </div>
  );
}

export function SearchPanel() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") ?? "";
  const { t } = useTranslation();

  const [q, setQ] = useState(initialQ);
  const [rows, setRows] = useState<CodeResult[]>([]);
  const [suggestions, setSuggestions] = useState<CodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQ && initialQ !== q) {
      setQ(initialQ);
      void executeSearch(initialQ);
    }
  }, [initialQ]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (q.trim().length < 2 || searched) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await api.autocomplete(q);
        setSuggestions(res.results);
        setShowDropdown(res.results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [q, searched]);

  const grouped = useMemo(() => {
    const map = new Map<string, CodeResult>();
    for (const s of suggestions) {
      if (!map.has(s.hsCode)) map.set(s.hsCode, s);
    }
    return Array.from(map.entries());
  }, [suggestions]);

  const resultGroups = useMemo(() => {
    const map = new Map<string, CodeResult[]>();
    for (const r of rows) {
      const key = `${r.country}-${r.hsCode}`;
      const g = map.get(key);
      if (g) g.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map.entries());
  }, [rows]);

  async function executeSearch(query?: string) {
    const term = (query ?? q).trim();
    if (!term) return;
    setLoading(true);
    setRows([]);
    setSuggestions([]);
    setShowDropdown(false);
    setSearched(true);
    try {
      const res = await api.search(term);
      setRows(res.results);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(code: string) {
    setShowDropdown(false);
    setSelectedCode(code);
    setQ(code);
    setSearched(true);
  }

  return (
    <>
      <section
        style={{
          paddingTop: 48,
          paddingBottom: 24,
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {t("search.title")}
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 15,
              color: "var(--text-secondary)",
              maxWidth: 480,
              margin: "10px auto 0",
              lineHeight: 1.5,
            }}
          >
            {t("search.subtitle")}
          </p>
        </div>

        <div ref={wrapperRef} style={{ position: "relative", maxWidth: 580, margin: "0 auto" }}>
          <div style={{ position: "relative" }}>
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
              ref={inputRef}
              className="input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSearched(false);
              }}
              onFocus={() => {
                if (suggestions.length > 0 && !searched) setShowDropdown(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void executeSearch();
                }
              }}
              placeholder={t("search.placeholder")}
              style={{
                paddingLeft: 46,
                paddingRight: 90,
                height: 52,
                fontSize: 16,
                borderRadius: "var(--radius)",
              }}
              aria-label="Search HS codes"
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setRows([]);
                  setSuggestions([]);
                  setShowDropdown(false);
                  setSearched(false);
                  inputRef.current?.focus();
                }}
                style={{
                  position: "absolute",
                  right: 80,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
                aria-label="Clear search"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => void executeSearch()}
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
              {t("search.btn")}
            </button>
          </div>

          {showDropdown && grouped.length > 0 && !loading && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow-lg)",
                overflow: "hidden",
                zIndex: 20,
                animation: "slideUp 0.15s ease-out",
              }}
            >
              {grouped.slice(0, 6).map(([code, item]) => (
                <button
                  type="button"
                  key={`${item.country}-${code}-${item.descriptionEn}`}
                  onClick={() => handleSelect(code)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "12px 16px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 14,
                    color: "var(--text)",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 52, fontFamily: "monospace" }}>{code}</span>
                  <CountryBadge country={item.country} />
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--text-secondary)",
                      fontSize: 13,
                    }}
                  >
                    {item.descriptionEn}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {loading ? t("search.loading") : searched ? t("search.results", { n: rows.length }) : t("search.enter")}
          </span>
        </div>

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : resultGroups.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {resultGroups.map(([groupKey, group], i) => {
              const primary = group[0];
              return (
                <article
                  className="card"
                  key={`${groupKey}-${primary.descriptionEn}`}
                  onClick={() => handleSelect(primary.hsCode)}
                  style={{
                    padding: 20,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    animationDelay: `${i * 40}ms`,
                    animation: "slideUp 0.3s ease-out both",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>
                        {primary.hsCode}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        {Array.from(new Set(group.map((r) => r.country))).map((c) => (
                          <CountryBadge key={c} country={c} />
                        ))}
                      </div>
                    </div>
                    <DutyChip rate={primary.dutyRate} />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {primary.descriptionEn}
                  </p>
                  {primary.descriptionLocal && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {primary.descriptionLocal}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : searched && !loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              color: "var(--text-muted)",
              fontSize: 15,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128269;</div>
            <div style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{t("search.empty.title")}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>{t("search.empty.desc")}</div>
          </div>
        ) : !searched ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              color: "var(--text-muted)",
              fontSize: 15,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128230;</div>
            <div style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
              {t("search.hero.title")}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {t("search.hero.desc")}
            </div>
          </div>
        ) : null}
      </section>

      {selectedCode && (
        <CodePopup code={selectedCode} onClose={() => setSelectedCode(null)} />
      )}
    </>
  );
}
