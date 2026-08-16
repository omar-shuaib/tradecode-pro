"use client";

import { useState } from "react";
import { Brain, Search, Globe, CheckCircle, AlertTriangle, Trophy, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";
import { useTranslation } from "../../lib/i18n";
import { CodePopup } from "../../components/CodePopup";
import { ExportMenu } from "../../components/ExportMenu";
import { cn } from "../../lib/utils";

type ClassifiedItem = {
  country: string;
  hsCode: string;
  descriptionEn: string;
  descriptionLocal: string | null;
  dutyRate: number | null;
  secondaryRate: number | null;
  requiresLicence: boolean;
  requiresInspection: boolean;
  isRestricted: boolean;
  isProhibited: boolean;
  confidence?: number;
};

function normalizeResult(item: any): ClassifiedItem {
  return {
    country: item.country ?? "CN",
    hsCode: item.hsCode ?? item.hs_code ?? item.code ?? "unknown",
    descriptionEn: item.descriptionEn ?? item.description_en ?? item.description ?? "No description",
    descriptionLocal: item.descriptionLocal ?? item.description_local ?? null,
    dutyRate: item.dutyRate ?? item.duty_rate ?? item.bcd_rate ?? item.mfn_duty_rate ?? item.customs_duty_rate ?? null,
    secondaryRate: item.secondaryRate ?? item.secondary_rate ?? item.igst_rate ?? item.vat_rate ?? null,
    requiresLicence: Boolean(item.requiresLicence ?? item.requires_licence),
    requiresInspection: Boolean(item.requiresInspection ?? item.requires_inspection),
    isRestricted: Boolean(item.isRestricted ?? item.is_restricted),
    isProhibited: Boolean(item.isProhibited ?? item.is_prohibited),
    confidence: typeof item.confidence === "number" ? item.confidence : undefined,
  };
}

function confidenceColor(c: number): string {
  if (c >= 80) return "var(--success)";
  if (c >= 50) return "var(--accent)";
  if (c >= 30) return "var(--warning)";
  return "var(--error)";
}

function confidenceBg(c: number): string {
  if (c >= 80) return "var(--success-light)";
  if (c >= 50) return "var(--accent-light)";
  if (c >= 30) return "var(--warning-light)";
  return "var(--error-light)";
}

function confidenceLabel(c: number): string {
  if (c >= 90) return "Excellent match";
  if (c >= 75) return "Strong match";
  if (c >= 50) return "Good match";
  if (c >= 30) return "Partial match";
  if (c >= 15) return "Weak match";
  return "Low relevance";
}

function ConfidenceBar({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          backgroundColor: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: confidenceColor(score),
            transition: "width 0.6s ease-out",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: confidenceColor(score),
          minWidth: 36,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {score}%
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton" style={{ width: 80, height: 18 }} />
          <div className="skeleton" style={{ width: 40, height: 16 }} />
        </div>
        <div className="skeleton" style={{ width: 50, height: 20 }} />
      </div>
      <div className="skeleton" style={{ width: "80%", height: 14 }} />
      <div className="skeleton" style={{ width: "100%", height: 6 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <div className="skeleton" style={{ width: 64, height: 18 }} />
        <div className="skeleton" style={{ width: 52, height: 18 }} />
      </div>
    </div>
  );
}

export default function ClassifyPage() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const { t, locale } = useTranslation();

  const samples = [
    t("classify.sample.electric"),
    t("classify.sample.herbal"),
    t("classify.sample.lithium"),
    t("classify.sample.plastic"),
  ];

  async function classify() {
    setLoading(true);
    try {
      setResult(await api.classify({ description, country: "BOTH", lang: "en" }));
    } finally {
      setLoading(false);
    }
  }

  const items = (result?.results ?? []).map(normalizeResult);

  // Group by country, each already sorted by confidence from backend
  const byCountry: Record<string, ClassifiedItem[]> = {
    CN: items.filter((i: ClassifiedItem) => i.country === "CN"),
    IN: items.filter((i: ClassifiedItem) => i.country === "IN"),
    AE: items.filter((i: ClassifiedItem) => i.country === "AE"),
    OTHER: items.filter((i: ClassifiedItem) => !["CN", "IN", "AE"].includes(i.country)),
  };

  const countryMeta: Record<string, { label: string; color: string; bg: string }> = {
    CN: { label: "China", color: "var(--warning)", bg: "var(--warning-light)" },
    IN: { label: "India", color: "var(--success)", bg: "var(--success-light)" },
    AE: { label: "UAE", color: "var(--country-ae-text)", bg: "var(--country-ae-bg)" },
    OTHER: { label: "All countries", color: "var(--text-secondary)", bg: "var(--bg-elevated)" },
  };

  return (
    <main className="page-shell" style={{ paddingBottom: 80 }}>
      <section
        style={{
          paddingTop: 80,
          paddingBottom: 48,
          textAlign: "center",
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius)",
            backgroundColor: "var(--accent-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Brain style={{ width: 28, height: 28, color: "var(--accent)" }} />
        </div>

        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 800,
            color: "var(--text)",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {t("classify.title")}
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: "clamp(14px, 2vw, 16px)",
            color: "var(--text-secondary)",
            maxWidth: 480,
            margin: "12px auto 0",
            lineHeight: 1.6,
          }}
        >
          {t("classify.subtitle")}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>
            <Search style={{ width: 12, height: 12 }} />
            {t("classify.badge.smart")}
          </span>
          <span className="badge" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            <Globe style={{ width: 12, height: 12 }} />
            {t("classify.badge.count")}
          </span>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {samples.map((sample) => (
            <button
              key={sample}
              className="btn-secondary"
              type="button"
              onClick={() => setDescription(sample)}
              style={{
                justifyContent: "flex-start",
                padding: "12px 16px",
                fontSize: 13,
                textAlign: "left",
                height: "auto",
                lineHeight: 1.4,
              }}
            >
              <Search style={{ width: 14, height: 14, flexShrink: 0, color: "var(--text-muted)" }} />
              {sample}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: 24, display: "grid", gap: 14, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)" }}>
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("classify.placeholder")}
          style={{ minHeight: 160, resize: "vertical", fontSize: 15, lineHeight: 1.6 }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            onClick={classify}
            disabled={!description.trim() || loading}
            style={{ height: 42, opacity: !description.trim() || loading ? 0.6 : 1, cursor: !description.trim() || loading ? "not-allowed" : "pointer" }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-flex", animation: "shimmer 1.8s ease-in-out infinite" }}>
                  <Brain style={{ width: 16, height: 16 }} />
                </span>
                {t("classify.loading")}
              </>
            ) : (
              <>
                <Brain style={{ width: 16, height: 16 }} />
                {t("classify.btn")}
              </>
            )}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{t("classify.result.title")}</div>
                <div style={{ marginTop: 2, fontSize: 13, color: "var(--text-muted)" }}>
                  {result.fallback ? t("classify.result.fallback") : t("classify.result.direct")}
                </div>
              </div>
              <span className={cn("badge", items.length ? "badge-success" : "badge-warning")}>
                {t("classify.result.matches", { n: items.length })}
              </span>
            </div>

            {items.length > 0 ? (
              <div style={{ display: "grid", gap: 24 }}>
                {(Object.keys(byCountry) as Array<keyof typeof byCountry>).map((code) => {
                  const countryItems = byCountry[code];
                  if (!countryItems.length) return null;
                  const meta = countryMeta[code];
                  return (
                    <div key={code}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                          paddingBottom: 8,
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="badge"
                          style={{ backgroundColor: meta.bg, color: meta.color, fontSize: 13, fontWeight: 600 }}
                        >
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {countryItems.length} result{countryItems.length !== 1 ? "s" : ""} ranked by relevance
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {countryItems.map((item: ClassifiedItem, i: number) => {
                          const hasComplianceNote = item.requiresLicence || item.isRestricted || item.isProhibited;
                          const dutyHigh = code === "CN" ? 13 : code === "IN" ? 15 : 10;
                          const hasDuty = item.dutyRate != null;
                          const isHighDuty = hasDuty && item.dutyRate! >= dutyHigh;
                          const conf = item.confidence ?? Math.max(10, 90 - i * 15);
                          const isBest = i === 0 && conf >= 50;

                          return (
                            <article
                              key={`${item.country}-${item.hsCode}-${i}`}
                              className={cn("card", isBest && "ring-accent")}
                              onClick={() => setSelectedCode(item.hsCode)}
                              style={{
                                padding: 16,
                                cursor: "pointer",
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gridTemplateRows: "auto auto auto",
                                gap: "4px 16px",
                                animationDelay: `${i * 40}ms`,
                                animation: "slideUp 0.3s ease-out both",
                                borderLeft: isBest ? `3px solid var(--accent)` : undefined,
                              }}
                            >
                              {/* Row 1: Code + Country + Confidence */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                                  {item.hsCode}
                                </span>
                                {isBest && (
                                  <span className="badge" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", fontSize: 10, padding: "1px 6px" }}>
                                    <Trophy style={{ width: 10, height: 10 }} /> Best
                                  </span>
                                )}
                                <span
                                  className="badge"
                                  style={{ backgroundColor: meta.bg, color: meta.color, fontSize: 11, padding: "1px 6px" }}
                                >
                                  {meta.label}
                                </span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: confidenceBg(conf),
                                    color: confidenceColor(conf),
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {item.dutyRate != null ? `${item.dutyRate}%` : "N/A"}
                                </span>
                              </div>

                              {/* Row 2: Description */}
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 13,
                                  lineHeight: 1.5,
                                  color: "var(--text-secondary)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  gridColumn: "1 / -1",
                                }}
                              >
                                {locale === "zh" && item.descriptionLocal ? item.descriptionLocal : item.descriptionEn}
                              </p>

                              {/* Row 3: Confidence Bar */}
                              <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                  <TrendingUp style={{ width: 12, height: 12, color: confidenceColor(conf) }} />
                                  <span style={{ fontSize: 11, fontWeight: 500, color: confidenceColor(conf) }}>
                                    {confidenceLabel(conf)}
                                  </span>
                                </div>
                                <ConfidenceBar score={conf} />
                              </div>

                              {/* Row 4: Tags */}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, gridColumn: "1 / -1", marginTop: 4 }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    borderRadius: 9999,
                                    backgroundColor: !hasDuty ? "var(--bg-elevated)" : isHighDuty ? "var(--warning-light)" : "var(--success-light)",
                                    color: !hasDuty ? "var(--text-muted)" : isHighDuty ? "var(--warning)" : "var(--success)",
                                  }}
                                >
                                  {hasDuty ? (isHighDuty ? <AlertTriangle style={{ width: 11, height: 11 }} /> : <CheckCircle style={{ width: 11, height: 11 }} />) : null}
                                  {!hasDuty ? t("classify.result.nodata") : isHighDuty ? t("classify.result.high") : t("classify.result.normal")}
                                </span>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    borderRadius: 9999,
                                    backgroundColor: hasComplianceNote ? "var(--warning-light)" : "var(--success-light)",
                                    color: hasComplianceNote ? "var(--warning)" : "var(--success)",
                                  }}
                                >
                                  {hasComplianceNote ? <AlertTriangle style={{ width: 11, height: 11 }} /> : <CheckCircle style={{ width: 11, height: 11 }} />}
                                  {hasComplianceNote ? t("classify.result.compliance") : t("classify.result.clear")}
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card" style={{ padding: 32, textAlign: "center" }}>
                <Search style={{ width: 32, height: 32, color: "var(--text-muted)", margin: "0 auto 10px" }} />
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
                  {t("classify.empty.title")}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  {t("classify.empty.desc")}
                </p>
              </div>
            )}

            {items.length > 0 && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                <ExportMenu data={result} />
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            <Search style={{ width: 32, height: 32, margin: "0 auto 10px", color: "var(--text-muted)" }} />
            <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 14 }}>
              {t("classify.prompt.title")}
            </div>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {t("classify.prompt.desc")}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            {(["China", "India", "UAE"] as const).map((label) => (
              <div key={label}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <SkeletonCard key={`${label}-${i}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedCode && <CodePopup code={selectedCode} onClose={() => setSelectedCode(null)} />}
    </main>
  );
}
