"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CodeResult } from "../../../lib/shared-types";
import { Search, X, Database, AlertTriangle, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { api, type BrowseResponse, type ChapterInfo } from "../../../lib/api";
import { useTranslation } from "../../../lib/i18n";
import { cn } from "../../../lib/utils";
import { CodePopup } from "../../../components/CodePopup";

type Props = { params: Promise<{ country: "CN" | "IN" | "AE" }> };

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
  const { t, locale } = useTranslation();
  const [country, setCountry] = useState<"CN" | "IN" | "AE">("CN");

  const [rows, setRows] = useState<CodeResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [chapter, setChapter] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("hsCode");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string | null>(null);

  const limit = 100;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (c: "CN" | "IN" | "AE", p: number, ch: string, q: string, s: string, o: string) => {
      setLoading(true);
      try {
        const res: BrowseResponse = await api.browse(c, { page: p, limit, chapter: ch, q, sort: s, order: o });
        setRows(res.results);
        setTotal(res.total);
        setChapters(res.chapters);
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    params.then(({ country: c }) => {
      if (!active) return;
      setCountry(c);
      setPage(1);
      setChapter("");
      setQuery("");
      setSort("hsCode");
      setOrder("asc");
      fetchData(c, 1, "", "", "hsCode", "asc");
    });
    return () => { active = false; };
  }, [params, fetchData]);

  useEffect(() => {
    fetchData(country, page, chapter, query, sort, order);
  }, [country, page, chapter, sort, order, fetchData]);

  const handleQueryChange = useCallback(
    (v: string) => {
      setQuery(v);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchData(country, 1, chapter, v, sort, order);
      }, 300);
    },
    [country, chapter, sort, order, fetchData]
  );

  const handleChapterChange = useCallback((ch: string) => {
    setChapter(ch);
    setPage(1);
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev === field) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setOrder("asc");
      return field;
    });
    setPage(1);
  }, []);

  const countryName = country === "CN" ? t("common.china") : country === "IN" ? t("common.india") : t("common.uae");

  const SortIcon = ({ field }: { field: string }) => {
    if (sort !== field) return <ArrowUpDown className="w-3 h-3" style={{ color: "var(--text-muted)" }} />;
    return order === "asc"
      ? <ArrowUp className="w-3 h-3" style={{ color: "var(--accent)" }} />
      : <ArrowDown className="w-3 h-3" style={{ color: "var(--accent)" }} />;
  };

  return (
    <>
      <main className="page-shell py-10 space-y-6 animate-fade-in">
        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                {t("db.label")}
              </p>
              <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                {t("db.explorer", { country: countryName })}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("db.desc")}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              {(["CN", "IN", "AE"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => router.push(`/database/${c}`)}
                  className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", country === c ? "shadow-sm" : "")}
                  style={{
                    background: country === c ? "var(--accent)" : "transparent",
                    color: country === c ? "var(--accent-text)" : "var(--text-secondary)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>
              {total.toLocaleString()} {t("db.results", { n: "" }).replace(/\s*\d*\s*$/, "").trim() || t("db.rows")}
            </span>
            <span className="badge badge-success">
              {chapters.length} {t("db.chapters")}
            </span>
          </div>
        </section>

        {/* Search + Sort row */}
        <section className="card p-4 animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t("db.search.placeholder")}
                className="input pl-10 pr-10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleQueryChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-80 transition"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              {([
                { key: "hsCode", label: t("db.sort.hs") },
                { key: "dutyRate", label: t("db.sort.duty") },
                { key: "description", label: t("db.sort.desc") },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    sort === key ? "shadow-sm" : ""
                  )}
                  style={{
                    background: sort === key ? "var(--accent)" : "transparent",
                    color: sort === key ? "var(--accent-text)" : "var(--text-secondary)",
                  }}
                >
                  {label}
                  <SortIcon field={key} />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Chapter Filter */}
        {chapters.length > 0 && (
          <section className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {t("db.chapter.filter")}
              </p>
              {chapter && (
                <button type="button" onClick={() => handleChapterChange("")} className="btn-ghost text-xs py-1 px-2">
                  {t("db.chapter.clear")}
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
              <button
                type="button"
                onClick={() => handleChapterChange("")}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  !chapter ? "shadow-sm" : "hover:opacity-80"
                )}
                style={{
                  background: !chapter ? "var(--accent)" : "var(--bg-elevated)",
                  color: !chapter ? "var(--accent-text)" : "var(--text-secondary)",
                  border: `1px solid ${!chapter ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {t("db.chapter.clear")}
              </button>
              {chapters.map((ch) => (
                <button
                  key={ch.code}
                  type="button"
                  onClick={() => handleChapterChange(ch.code)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    chapter === ch.code ? "shadow-sm" : "hover:opacity-80"
                  )}
                  style={{
                    background: chapter === ch.code ? "var(--accent)" : "var(--bg-elevated)",
                    color: chapter === ch.code ? "var(--accent-text)" : "var(--text-secondary)",
                    border: `1px solid ${chapter === ch.code ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {ch.code} — {ch.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Results */}
        <section>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="card p-12 text-center space-y-3 animate-fade-in">
              <Database className="w-10 h-10 mx-auto" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {t("db.empty.title")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t("db.empty.desc")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((row, idx) => (
                <article
                  key={`${row.country}-${row.hsCode}-${idx}`}
                  className="card p-4 cursor-pointer group animate-slide-up"
                  style={{ animationDelay: `${Math.min(idx * 15, 200)}ms` }}
                  onClick={() => setSelected(row.hsCode)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
                      {row.hsCode}
                    </span>
                    <span className="badge shrink-0">{row.country}</span>
                  </div>

                  <p className="text-sm mb-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {locale === "zh" && row.descriptionLocal ? row.descriptionLocal : row.descriptionEn}
                  </p>
                  {locale === "zh" && row.descriptionLocal && (
                    <p className="text-xs mb-3 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                      {row.descriptionEn}
                    </p>
                  )}
                  {locale !== "zh" && row.descriptionLocal && (
                    <p className="text-xs mb-3 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                      {row.descriptionLocal}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={cn("badge", dutyVariant(row.dutyRate))}>
                      {t("db.duty")}: {dutyLabel(row.dutyRate)}
                    </span>
                    {row.secondaryRate != null && (
                      <span className={cn("badge", dutyVariant(row.secondaryRate))}>
                        {t("db.scd")}: {dutyLabel(row.secondaryRate)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Ch. {row.chapter ?? "\u2014"}
                    </span>
                  </div>

                  {(row.importPolicy || row.supervisoryConditions || row.isRestricted || row.isProhibited) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "var(--warning)" }} />
                      {row.importPolicy && <span className="badge badge-warning text-[10px] py-0">{row.importPolicy}</span>}
                      {row.supervisoryConditions && <span className="badge badge-warning text-[10px] py-0">{row.supervisoryConditions}</span>}
                      {row.isRestricted && <span className="badge badge-error text-[10px] py-0">{t("db.restricted")}</span>}
                      {row.isProhibited && <span className="badge badge-error text-[10px] py-0">{t("db.prohibited")}</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--accent)" }}>
                      {t("db.view.details")}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <section className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              <ChevronLeft className="w-4 h-4" />
              {t("db.prev")}
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                      page === pageNum ? "shadow-sm" : "hover:opacity-80"
                    )}
                    style={{
                      background: page === pageNum ? "var(--accent)" : "transparent",
                      color: page === pageNum ? "var(--accent-text)" : "var(--text-secondary)",
                      border: `1px solid ${page === pageNum ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
            >
              {t("db.next")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        )}

        {/* Page info */}
        {total > 0 && (
          <div className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {t("db.page", { n: page, m: totalPages })} &middot; {total.toLocaleString()} {t("db.rows")}
          </div>
        )}
      </main>

      {selected && <CodePopup code={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
