"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CodeResult } from "../../../lib/shared-types";
import { Search, X, Database, BarChart3, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { CodePopup } from "../../../components/CodePopup";

type Props = { params: Promise<{ country: "CN" | "IN" }> };

function dutyVariant(rate?: number | null): "success" | "warning" | "error" {
  if (rate == null) return "success";
  if (rate >= 15) return "error";
  if (rate >= 8) return "warning";
  return "success";
}

function dutyLabel(rate?: number | null) {
  if (rate == null) return "N/A";
  return `${rate}%`;
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="skeleton h-6 w-28" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-3 w-3/4" />
      <div className="flex gap-2 pt-1">
        <div className="skeleton h-6 w-16 rounded-full" />
        <div className="skeleton h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}

export default function DatabasePage({ params }: Props) {
  const router = useRouter();
  const [country, setCountry] = useState<"CN" | "IN">("CN");
  const [rows, setRows] = useState<CodeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    params.then(({ country: nextCountry }) => {
      if (!active) return;
      setCountry(nextCountry);
      setLoading(true);
      api
        .search("", nextCountry)
        .then((res) => {
          if (active) setRows(res.results ?? []);
        })
        .catch(() => {
          if (active) setRows([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [params]);

  const chapters = useMemo(() => {
    const set = new Set(rows.map((row) => String(row.chapter ?? "").slice(0, 2)).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = rows.filter((row) => {
    const chapterOk = chapter === "All" || String(row.chapter ?? "").startsWith(chapter);
    const q = query.trim().toLowerCase();
    const queryOk =
      !q ||
      String(row.hsCode).includes(q) ||
      String(row.descriptionEn ?? "").toLowerCase().includes(q) ||
      String(row.descriptionLocal ?? "").toLowerCase().includes(q);
    return chapterOk && queryOk;
  });

  const stats = useMemo(() => {
    const highRate = rows.filter((row) => (row.dutyRate ?? 0) >= 15 || (row.secondaryRate ?? 0) >= 13).length;
    const withNotes = rows.filter((row) => Boolean(row.descriptionLocal || row.importPolicy || row.supervisoryConditions)).length;
    return { total: rows.length, highRate, withNotes };
  }, [rows]);

  return (
    <>
      <main className="page-shell py-10 space-y-8 animate-fade-in">
        {/* Hero */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                Database
              </p>
              <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                {country === "CN" ? "China" : "India"} Explorer
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Browse loaded HS codes, filter by chapter, and inspect duty details.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => router.push("/database/CN")}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", country === "CN" ? "shadow-sm" : "")}
                style={{
                  background: country === "CN" ? "var(--accent)" : "transparent",
                  color: country === "CN" ? "var(--accent-text)" : "var(--text-secondary)",
                }}
              >
                CN
              </button>
              <button
                type="button"
                onClick={() => router.push("/database/IN")}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", country === "IN" ? "shadow-sm" : "")}
                style={{
                  background: country === "IN" ? "var(--accent)" : "transparent",
                  color: country === "IN" ? "var(--accent-text)" : "var(--text-secondary)",
                }}
              >
                IN
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge">{stats.total.toLocaleString()} rows</span>
            <span className="badge badge-success">{chapters.length - 1} chapters</span>
            <span className="badge badge-warning">{stats.highRate} high-duty</span>
            <span className="badge badge-error">{stats.withNotes} flagged</span>
          </div>
        </section>

        {/* Search */}
        <section className="card p-4 animate-slide-up">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by HS code or description..."
              className="input pl-10 pr-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-80 transition"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* Chapter Filter */}
        <section className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Chapter filter
            </p>
            {chapter !== "All" && (
              <button
                type="button"
                onClick={() => setChapter("All")}
                className="btn-ghost text-xs py-1 px-2"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {chapters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setChapter(item)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  chapter === item ? "shadow-sm" : "hover:opacity-80"
                )}
                style={{
                  background: chapter === item ? "var(--accent)" : "var(--bg-elevated)",
                  color: chapter === item ? "var(--accent-text)" : "var(--text-secondary)",
                  border: `1px solid ${chapter === item ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* Results */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {filtered.length.toLocaleString()} results
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center space-y-3 animate-fade-in">
              <Database className="w-10 h-10 mx-auto" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No results found
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Try adjusting your search or chapter filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((row, idx) => (
                <article
                  key={`${row.country}-${row.hsCode}-${row.descriptionEn}`}
                  className="card p-4 cursor-pointer group animate-slide-up"
                  style={{ animationDelay: `${Math.min(idx * 20, 300)}ms` }}
                  onClick={() => setSelected(row.hsCode)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className="font-mono text-lg font-bold tracking-tight"
                      style={{ color: "var(--text)" }}
                    >
                      {row.hsCode}
                    </span>
                    <span className="badge shrink-0">
                      {row.country}
                    </span>
                  </div>

                  <p className="text-sm mb-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {row.descriptionEn}
                  </p>
                  {row.descriptionLocal && (
                    <p className="text-xs mb-3 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                      {row.descriptionLocal}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={cn("badge", dutyVariant(row.dutyRate))}>
                      Duty: {dutyLabel(row.dutyRate)}
                    </span>
                    {row.secondaryRate != null && (
                      <span className={cn("badge", dutyVariant(row.secondaryRate))}>
                        SCD: {dutyLabel(row.secondaryRate)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Ch. {row.chapter ?? "—"}
                    </span>
                  </div>

                  {(row.importPolicy || row.supervisoryConditions || row.isRestricted || row.isProhibited) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "var(--warning)" }} />
                      {row.importPolicy && <span className="badge badge-warning text-[10px] py-0">{row.importPolicy}</span>}
                      {row.supervisoryConditions && <span className="badge badge-warning text-[10px] py-0">{row.supervisoryConditions}</span>}
                      {row.isRestricted && <span className="badge badge-error text-[10px] py-0">Restricted</span>}
                      {row.isProhibited && <span className="badge badge-error text-[10px] py-0">Prohibited</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--accent)" }}>
                      View details
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {selected && <CodePopup code={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
