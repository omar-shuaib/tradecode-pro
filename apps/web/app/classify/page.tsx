"use client";

import { useState } from "react";
import { Brain, Search, Globe, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useTranslation } from "../../lib/i18n";
import { CodePopup } from "../../components/CodePopup";
import { cn } from "../../lib/utils";

function normalizeResult(item: any) {
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
  };
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
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
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
  const { t } = useTranslation();

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

      <section className="card" style={{ padding: 24, display: "grid", gap: 14 }}>
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
              <span
                className={cn(
                  "badge",
                  items.length ? "badge-success" : "badge-warning"
                )}
              >
                {t("classify.result.matches", { n: items.length })}
              </span>
            </div>

            {items.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {items.map((item: ReturnType<typeof normalizeResult>, i: number) => {
                  const hasComplianceNote = item.requiresLicence || item.isRestricted || item.isProhibited;
                  const dutyHigh = item.country === "CN" ? 13 : item.country === "IN" ? 15 : 10;
                  const isHighDuty = (item.dutyRate ?? 0) >= dutyHigh;

                  return (
                    <article
                      key={`${item.country}-${item.hsCode}-${item.descriptionEn}`}
                      className="card"
                      onClick={() => setSelectedCode(item.hsCode)}
                      style={{
                        padding: 20,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        animationDelay: `${i * 50}ms`,
                        animation: "slideUp 0.3s ease-out both",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                            {item.hsCode}
                          </span>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: item.country === "CN" ? "var(--warning-light)" : item.country === "IN" ? "var(--success-light)" : "#e0f2fe",
                              color: item.country === "CN" ? "var(--warning)" : item.country === "IN" ? "var(--success)" : "#0284c7",
                              fontSize: 11,
                              padding: "1px 8px",
                              alignSelf: "flex-start",
                            }}
                          >
                            {item.country === "CN" ? t("common.china") : item.country === "IN" ? t("common.india") : t("common.uae")}
                          </span>
                        </div>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isHighDuty ? "var(--warning-light)" : "var(--accent-light)",
                            color: isHighDuty ? "var(--warning)" : "var(--accent)",
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "monospace",
                          }}
                        >
                          {item.dutyRate != null ? `${item.dutyRate}%` : t("common.na")}
                        </span>
                      </div>

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
                        }}
                      >
                        {item.descriptionEn}
                      </p>

                      {item.descriptionLocal && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                          {item.descriptionLocal}
                        </p>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 500,
                            borderRadius: 9999,
                            backgroundColor: isHighDuty ? "var(--warning-light)" : "var(--success-light)",
                            color: isHighDuty ? "var(--warning)" : "var(--success)",
                          }}
                        >
                          {isHighDuty ? <AlertTriangle style={{ width: 11, height: 11 }} /> : <CheckCircle style={{ width: 11, height: 11 }} />}
                          {isHighDuty ? t("classify.result.high") : t("classify.result.normal")}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
              marginTop: 14,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}
      </section>

      {selectedCode && <CodePopup code={selectedCode} onClose={() => setSelectedCode(null)} />}
    </main>
  );
}
