"use client";

import { useState } from "react";
import { Search, Globe, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { api } from "../lib/api";
import { useTranslation } from "../lib/i18n";
import { cn } from "../lib/utils";

type MatchRow = {
  china?: {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal?: string;
    dutyRate?: number | null;
    secondaryRate?: number | null;
    supervisoryConditions?: string;
    isRestricted?: boolean | null;
    isProhibited?: boolean | null;
    requiresLicence?: boolean | null;
    requiresInspection?: boolean | null;
  } | null;
  india?: {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal?: string;
    dutyRate?: number | null;
    secondaryRate?: number | null;
    importPolicy?: string;
    isRestricted?: boolean | null;
    isProhibited?: boolean | null;
    requiresLicence?: boolean | null;
    requiresInspection?: boolean | null;
  } | null;
  matchConfidence?: number;
};

function RateBar({ value, max = 30 }: { value?: number | null; max?: number }) {
  if (value == null) return null;
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 15 ? "var(--error)" : value >= 8 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function ComplianceChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CheckCircle;
  label: string;
  tone: "good" | "warn";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 9999,
        backgroundColor: tone === "good" ? "var(--success-light)" : "var(--warning-light)",
        color: tone === "good" ? "var(--success)" : "var(--warning)",
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 11, height: 11 }} />
      {label}
    </span>
  );
}

function SideCard({
  title,
  country,
  code,
  desc,
  sub,
  rateLabel,
  duty,
  secondary,
  extra,
  flags,
}: {
  title: string;
  country: string;
  code?: string;
  desc?: string;
  sub?: string;
  rateLabel: string;
  duty?: number | null;
  secondary?: number | null;
  extra?: string;
  flags: { icon: typeof CheckCircle; label: string; tone: "good" | "warn" }[];
}) {
  const dutyHigh = title === "CN" ? 12 : 15;
  const secondaryHigh = title === "CN" ? 13 : 10;

  return (
    <div className="card animate-slide-up" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Globe style={{ width: 16, height: 16, color: "var(--accent)" }} />
        <span
          className="badge"
          style={{
            backgroundColor: title === "CN" ? "var(--warning-light)" : "var(--success-light)",
            color: title === "CN" ? "var(--warning)" : "var(--success)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 4 }}>{country}</span>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
        {code ?? "\u2014"}
      </div>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        {desc ?? "No data available"}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{sub}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
            <span style={{ color: "var(--text-muted)" }}>{rateLabel}</span>
            <span
              style={{
                fontWeight: 600,
                fontFamily: "monospace",
                color: duty != null && duty >= dutyHigh ? "var(--error)" : "var(--text)",
              }}
            >
              {duty == null ? "n/a" : `${duty}%`}
            </span>
          </div>
          <RateBar value={duty} />
        </div>

        {secondary != null && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
              <span style={{ color: "var(--text-muted)" }}>{title === "CN" ? "VAT" : "IGST"}</span>
              <span
                style={{
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: secondary >= secondaryHigh ? "var(--error)" : "var(--text)",
                }}
              >
                {secondary}%
              </span>
            </div>
            <RateBar value={secondary} />
          </div>
        )}
      </div>

      {extra && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {extra}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {flags.map((f) => (
          <ComplianceChip key={f.label} icon={f.icon} label={f.label} tone={f.tone} />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="skeleton" style={{ width: 40, height: 20 }} />
        <div className="skeleton" style={{ width: 80, height: 20 }} />
      </div>
      <div className="skeleton" style={{ width: 140, height: 22 }} />
      <div className="skeleton" style={{ width: "80%", height: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
      <div className="skeleton" style={{ width: "100%", height: 24 }} />
      <div className="skeleton" style={{ width: "100%", height: 24 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton" style={{ width: 56, height: 18 }} />
        <div className="skeleton" style={{ width: 72, height: 18 }} />
      </div>
    </div>
  );
}

export function ComparisonView() {
  const [code, setCode] = useState("85371090");
  const [row, setRow] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  async function compare() {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.match(code, "IN");
      setRow((rows?.[0] ?? null) as MatchRow | null);
    } catch (e) {
      setRow(null);
      setError(e instanceof Error ? e.message : "Compare lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const china = row?.china ?? null;
  const india = row?.india ?? null;

  const cnFlags = [
    china?.dutyRate != null && china.dutyRate >= 12
      ? { icon: AlertTriangle, label: t("compare.high.mfn"), tone: "warn" as const }
      : { icon: CheckCircle, label: t("compare.normal.mfn"), tone: "good" as const },
    china?.requiresLicence ? { icon: AlertTriangle, label: t("compare.licence"), tone: "warn" as const } : null,
    china?.requiresInspection ? { icon: AlertTriangle, label: t("compare.inspection"), tone: "warn" as const } : null,
    china?.isRestricted ? { icon: AlertTriangle, label: t("compare.restricted"), tone: "warn" as const } : null,
    china?.isProhibited ? { icon: AlertTriangle, label: t("compare.prohibited"), tone: "warn" as const } : null,
  ].filter(Boolean) as { icon: typeof CheckCircle; label: string; tone: "good" | "warn" }[];

  const inFlags = [
    india?.dutyRate != null && india.dutyRate >= 15
      ? { icon: AlertTriangle, label: t("compare.high.bcd"), tone: "warn" as const }
      : { icon: CheckCircle, label: t("compare.normal.bcd"), tone: "good" as const },
    india?.requiresLicence ? { icon: AlertTriangle, label: t("compare.licence"), tone: "warn" as const } : null,
    india?.requiresInspection ? { icon: AlertTriangle, label: t("compare.inspection"), tone: "warn" as const } : null,
    india?.isRestricted ? { icon: AlertTriangle, label: t("compare.restricted"), tone: "warn" as const } : null,
    india?.isProhibited ? { icon: AlertTriangle, label: t("compare.prohibited"), tone: "warn" as const } : null,
  ].filter(Boolean) as { icon: typeof CheckCircle; label: string; tone: "good" | "warn" }[];

  return (
    <section className="page-shell" style={{ paddingBottom: 80 }}>
      <section
        style={{
          paddingTop: 48,
          paddingBottom: 24,
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("compare.label")}
          </p>
          <h1
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              fontWeight: 700,
              color: "var(--text)",
              margin: "8px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {t("compare.title")}
          </h1>
          <p style={{ marginTop: 10, fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, margin: "10px auto 0", lineHeight: 1.5 }}>
            {t("compare.subtitle")}
          </p>
        </div>

        <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 18,
                height: 18,
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("compare.placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  compare();
                }
              }}
              style={{
                paddingLeft: 42,
                paddingRight: 100,
                height: 48,
                fontSize: 15,
                borderRadius: "var(--radius)",
              }}
            />
            <button
              className="btn-primary"
              onClick={compare}
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                height: 38,
                padding: "0 18px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {t("compare.btn")}
            </button>
          </div>
        </div>
      </section>

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }} className="compare-grid-responsive">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <AlertTriangle style={{ width: 36, height: 36, color: "var(--error)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{error}</p>
        </div>
      )}

      {!loading && !error && !row && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-muted)" }}>
          <Globe style={{ width: 40, height: 40, margin: "0 auto 12px", color: "var(--text-muted)" }} />
          <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 15 }}>
            {t("compare.empty.title")}
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            {t("compare.empty.desc")}
          </div>
        </div>
      )}

      {row && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 20,
            }}
            className="compare-grid-responsive"
          >
            <SideCard
              title="CN"
              country={t("compare.cn.customs")}
              code={china?.hsCode}
              desc={china?.descriptionEn}
              sub={china?.descriptionLocal}
              rateLabel={t("compare.mfn")}
              duty={china?.dutyRate ?? null}
              secondary={china?.secondaryRate ?? null}
              extra={
                china?.supervisoryConditions
                  ? t("compare.supervisory.yes", { v: china.supervisoryConditions })
                  : t("compare.supervisory.no")
              }
              flags={cnFlags.length ? cnFlags : [{ icon: CheckCircle, label: t("compare.no.flags"), tone: "good" }]}
            />

            <SideCard
              title="IN"
              country={t("compare.in.customs")}
              code={india?.hsCode}
              desc={india?.descriptionEn}
              sub={india?.descriptionLocal}
              rateLabel={t("compare.bcd")}
              duty={india?.dutyRate ?? null}
              secondary={india?.secondaryRate ?? null}
              extra={
                india?.importPolicy
                  ? t("compare.policy.yes", { v: india.importPolicy })
                  : t("compare.policy.no")
              }
              flags={inFlags.length ? inFlags : [{ icon: CheckCircle, label: t("compare.no.flags"), tone: "good" }]}
            />
          </div>

          {row.matchConfidence != null && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
              <div
                className="card"
                style={{
                  padding: "14px 24px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Shield style={{ width: 18, height: 18, color: "var(--accent)" }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("compare.confidence")}</span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: "var(--accent-light)",
                    color: "var(--accent)",
                    fontSize: 16,
                    fontWeight: 700,
                    padding: "4px 12px",
                  }}
                >
                  {Number(row.matchConfidence).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 700px) {
          .compare-grid-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
