"use client";

import { useEffect, useMemo, useState } from "react";
import { X, CheckCircle, AlertTriangle, Shield, Calculator, Globe, Info } from "lucide-react";
import { api } from "../lib/api";
import { useTranslation } from "../lib/i18n";
import { cn } from "../lib/utils";
import { CompliancePanel } from "./CompliancePanel";
import { DutyDisclaimer } from "./DutyDisclaimer";

type CountrySide = {
  country: "CN" | "IN" | "AE";
  hsCode: string;
  descriptionEn: string;
  descriptionLocal?: string;
  dutyRate?: number | null;
  secondaryRate?: number | null;
  importPolicy?: string | null;
  supervisoryConditions?: string | null;
  requiresInspection?: boolean | null;
  inspectionAgency?: string | null;
  requiresLicence?: boolean | null;
  isRestricted?: boolean | null;
  isProhibited?: boolean | null;
};

type MatchRow = {
  china: CountrySide | null;
  india: CountrySide | null;
  uae: CountrySide | null;
  closestChina?: {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal?: string;
    chapter: string;
    dutyRate: number | null;
    secondaryRate: number | null;
    confidence: number;
  } | null;
  closestIndia?: {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal?: string;
    chapter: string;
    dutyRate: number | null;
    secondaryRate: number | null;
    confidence: number;
  } | null;
  closestUae?: {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal?: string;
    chapter: string;
    dutyRate: number | null;
    secondaryRate: number | null;
    confidence: number;
  } | null;
};

type DutyLine = { label: string; amount: number };

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

function FlagChip({ label, tone }: { label: string; tone: "good" | "warn" | "bad" }) {
  const colors = {
    good: { bg: "var(--success-light)", color: "var(--success)" },
    warn: { bg: "var(--warning-light)", color: "var(--warning)" },
    bad: { bg: "var(--error-light)", color: "var(--error)" },
  };
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
        backgroundColor: colors[tone].bg,
        color: colors[tone].color,
        whiteSpace: "nowrap",
      }}
    >
      {tone === "bad" ? (
        <X style={{ width: 11, height: 11 }} />
      ) : tone === "warn" ? (
        <AlertTriangle style={{ width: 11, height: 11 }} />
      ) : (
        <CheckCircle style={{ width: 11, height: 11 }} />
      )}
      {label}
    </span>
  );
}

function ClosestMatchPanel({
  match,
  country,
  t,
}: {
  match: NonNullable<MatchRow["closestChina"]>;
  country: string;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const confColor = match.confidence >= 70 ? "var(--success)" : match.confidence >= 40 ? "var(--warning)" : "var(--error)";
  const confLabel = match.confidence >= 70 ? t("compare.closest.high") : match.confidence >= 40 ? t("compare.closest.medium") : t("compare.closest.low");
  const sideLabel = country === "CN" ? t("popup.cn.customs") : country === "IN" ? t("popup.in.customs") : t("popup.ae.customs");

  return (
    <div
      className="card"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        border: "2px dashed var(--warning)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -12,
          left: 16,
          backgroundColor: "var(--warning-light)",
          color: "var(--warning)",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 10px",
          borderRadius: 9999,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {t("compare.closest.label")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Info style={{ width: 16, height: 16, color: "var(--warning)" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {sideLabel}
        </span>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
        {match.hsCode}
      </div>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        {match.descriptionEn}
      </p>
      {match.descriptionLocal && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          {match.descriptionLocal}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
          <span>{t("compare.closest.confidence")}</span>
          <span style={{ fontWeight: 600, color: confColor }}>{match.confidence}% — {confLabel}</span>
        </div>
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
              width: `${match.confidence}%`,
              backgroundColor: confColor,
              borderRadius: 3,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
      >
        {t("compare.closest.disclaimer")}
      </p>
    </div>
  );
}

function Panel({ side, t }: { side: CountrySide; t: (key: any, params?: Record<string, string | number>) => string }) {
  const sideLabel =
    side.country === "CN" ? t("popup.cn.customs") : side.country === "IN" ? t("popup.in.customs") : t("popup.ae.customs");
  const totalIncidence =
    side.dutyRate != null && side.secondaryRate != null
      ? (Number(side.dutyRate) + Number(side.secondaryRate)).toFixed(1)
      : null;

  const flags: { label: string; tone: "good" | "warn" | "bad" }[] = [];

  if (side.isProhibited) flags.push({ label: t("popup.prohibited"), tone: "bad" });
  if (side.isRestricted) flags.push({ label: t("popup.restricted"), tone: "warn" });
  if (side.requiresLicence) flags.push({ label: t("popup.licence"), tone: "warn" });
  if (side.requiresInspection)
    flags.push({
      label: side.inspectionAgency ? `${t("popup.inspection")}: ${side.inspectionAgency}` : t("popup.inspection"),
      tone: "warn",
    });
  if (side.importPolicy) flags.push({ label: `${t("popup.policy")}: ${side.importPolicy}`, tone: "warn" });
  if (side.supervisoryConditions)
    flags.push({ label: `${t("popup.supervisory")}: ${side.supervisoryConditions}`, tone: "warn" });

  const dutyHigh = side.country === "CN" ? 12 : side.country === "IN" ? 15 : 10;
  const secondaryHigh = side.country === "CN" ? 13 : side.country === "IN" ? 10 : 10;

  if (side.dutyRate != null && side.dutyRate >= dutyHigh)
    flags.push({ label: side.country === "CN" ? t("popup.high.mfn") : side.country === "IN" ? t("popup.high.bcd") : t("popup.high.mfn"), tone: "warn" });
  if (side.secondaryRate != null && side.secondaryRate >= secondaryHigh)
    flags.push({ label: side.country === "CN" ? t("popup.high.vat") : side.country === "IN" ? t("popup.high.igst") : t("popup.high.vat"), tone: "warn" });

  if (flags.length === 0)
    flags.push({ label: t("popup.no.flags"), tone: "good" });

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Globe style={{ width: 16, height: 16, color: "var(--accent)" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {sideLabel}
        </span>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
        {side.hsCode}
      </div>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        {side.descriptionEn}
      </p>
      {side.descriptionLocal && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          {side.descriptionLocal}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
            <span style={{ color: "var(--text-muted)" }}>
              {side.country === "CN" ? t("popup.mfn") : side.country === "IN" ? t("popup.bcd") : t("popup.customs.duty")}
            </span>
            <span
              style={{
                fontWeight: 600,
                color:
                  side.dutyRate != null && side.dutyRate >= dutyHigh
                    ? "var(--error)"
                    : "var(--text)",
              }}
            >
              {side.dutyRate == null ? "n/a" : `${side.dutyRate}%`}
            </span>
          </div>
          <RateBar value={side.dutyRate} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
            <span style={{ color: "var(--text-muted)" }}>
              {side.country === "CN" ? t("popup.vat") : side.country === "IN" ? t("popup.sws") : t("popup.vat")}
            </span>
            <span
              style={{
                fontWeight: 600,
                color:
                  side.secondaryRate != null && side.secondaryRate >= secondaryHigh
                    ? "var(--error)"
                    : "var(--text)",
              }}
            >
              {side.secondaryRate == null ? "n/a" : `${side.secondaryRate}%`}
            </span>
          </div>
          <RateBar value={side.secondaryRate} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {flags.map((f) => (
          <FlagChip key={f.label} label={f.label} tone={f.tone} />
        ))}
      </div>

      {totalIncidence && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--bg-elevated)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          {t("popup.total.incidence", { v: totalIncidence })}
        </div>
      )}
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="skeleton" style={{ width: 120, height: 14 }} />
      <div className="skeleton" style={{ width: 160, height: 24 }} />
      <div className="skeleton" style={{ width: "80%", height: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="skeleton" style={{ width: "100%", height: 28 }} />
        <div className="skeleton" style={{ width: "100%", height: 28 }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton" style={{ width: 60, height: 18 }} />
        <div className="skeleton" style={{ width: 80, height: 18 }} />
      </div>
    </div>
  );
}

export function CodePopup({ code, onClose }: { code: string; onClose: () => void }) {
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cif, setCif] = useState(10000);
  const [indiaDutyResult, setIndiaDutyResult] = useState<any>(null);
  const [uaeDutyResult, setUaeDutyResult] = useState<any>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setMatch(null);

    api
      .match(code, "IN")
      .then((rows) => {
        if (!active) return;
        const row = rows?.[0] ?? null;
        setMatch(row as MatchRow | null);
      })
      .catch((err) => {
        if (!active) return;
        setError(String(err?.message ?? err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [code]);

  const china = match?.china ?? null;
  const india = match?.india ?? null;
  const uae = match?.uae ?? null;

  const indiaDuty = useMemo(() => {
    if (!indiaDutyResult) return null;
    return indiaDutyResult.lines as DutyLine[];
  }, [indiaDutyResult]);

  const uaeDuty = useMemo(() => {
    if (!uaeDutyResult) return null;
    return uaeDutyResult.lines as DutyLine[];
  }, [uaeDutyResult]);

  useEffect(() => {
    let active = true;
    if (!india) {
      setIndiaDutyResult(null);
      return;
    }
    api
      .duty({ country: "IN", hsCode: india.hsCode, cifUsd: cif, landingChargesUsd: 0 })
      .then((res) => {
        if (active) setIndiaDutyResult(res);
      })
      .catch(() => {
        if (active) setIndiaDutyResult(null);
      });
    return () => {
      active = false;
    };
  }, [cif, india]);

  useEffect(() => {
    let active = true;
    if (!uae) {
      setUaeDutyResult(null);
      return;
    }
    api
      .duty({ country: "AE", hsCode: uae.hsCode, cifUsd: cif, landingChargesUsd: 0 })
      .then((res) => {
        if (active) setUaeDutyResult(res);
      })
      .catch(() => {
        if (active) setUaeDutyResult(null);
      });
    return () => {
      active = false;
    };
  }, [cif, uae]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (loading) {
    return (
      <div
        className="animate-fade-in"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="card"
          style={{
            width: "90%",
            maxWidth: 960,
            maxHeight: "90vh",
            overflow: "auto",
            padding: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="animate-fade-in"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="card"
          style={{
            width: "90%",
            maxWidth: 960,
            padding: 40,
            position: "relative",
            textAlign: "center",
          }}
        >
          <button
            className="btn-ghost"
            onClick={onClose}
            style={{ position: "absolute", top: 12, right: 12, padding: 6 }}
            aria-label="Close"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
          <AlertTriangle style={{ width: 40, height: 40, color: "var(--error)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{error}</p>
          <button className="btn-primary" onClick={onClose} style={{ marginTop: 16 }}>
            {t("popup.close")}
          </button>
        </div>
      </div>
    );
  }

  if (!china && !india && !uae) return null;

  const title = china?.hsCode ?? india?.hsCode ?? uae?.hsCode ?? code;
  const subtitle = china?.descriptionEn ?? india?.descriptionEn ?? uae?.descriptionEn ?? "";
  const localTitle = china?.descriptionLocal ?? india?.descriptionLocal ?? uae?.descriptionLocal ?? "";
  const totalIncidence = indiaDuty?.length
    ? indiaDuty.reduce((sum, line) => sum + line.amount, 0)
    : null;
  const uaeTotalIncidence = uaeDuty?.length
    ? uaeDuty.reduce((sum, line) => sum + line.amount, 0)
    : null;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Code details for ${code}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card animate-slide-up"
        style={{
          width: "100%",
          maxWidth: 960,
          maxHeight: "90vh",
          overflow: "auto",
          padding: 0,
          position: "relative",
        }}
      >
        <button
          className="btn-ghost"
          onClick={onClose}
          style={{
            position: "sticky",
            top: 12,
            float: "right",
            marginRight: 12,
            zIndex: 10,
            padding: 6,
            borderRadius: "var(--radius-sm)",
          }}
          aria-label="Close popup"
        >
          <X style={{ width: 20, height: 20 }} />
        </button>

        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Shield style={{ width: 20, height: 20, color: "var(--accent)" }} />
            <span style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
              {title}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {subtitle}
          </p>
          {localTitle && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {localTitle}
            </p>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            padding: 20,
          }}
          className="detail-split-responsive"
        >
          {china ? (
            <Panel side={china} t={t} />
          ) : match?.closestChina ? (
            <ClosestMatchPanel match={match.closestChina} country="CN" t={t} />
          ) : (
            <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <Globe style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                {t("popup.no.china")}
              </p>
            </div>
          )}
          {india ? (
            <Panel side={india} t={t} />
          ) : match?.closestIndia ? (
            <ClosestMatchPanel match={match.closestIndia} country="IN" t={t} />
          ) : (
            <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <Globe style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                {t("popup.no.india")}
              </p>
            </div>
          )}
          {uae ? (
            <Panel side={uae} t={t} />
          ) : match?.closestUae ? (
            <ClosestMatchPanel match={match.closestUae} country="AE" t={t} />
          ) : (
            <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", alignItems: "center" }}>
              <Globe style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                {t("popup.no.uae")}
              </p>
            </div>
          )}
        </div>

        {india && (
          <div style={{ padding: "0 20px 20px" }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Calculator style={{ width: 18, height: 18, color: "var(--accent)" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  {t("popup.calculator")}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{t("popup.cif")}</span>
                  <input
                    className="input"
                    type="number"
                    value={cif}
                    onChange={(e) => setCif(Number(e.target.value))}
                    style={{ height: 40 }}
                  />
                </label>
                <button className="btn-secondary" type="button" onClick={() => setCif(10000)} style={{ height: 40 }}>
                  {t("popup.reset")}
                </button>
              </div>

              {indiaDutyResult ? (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                    className="detail-split-responsive"
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        {t("popup.india.breakdown")}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {indiaDuty?.map((line, i) => (
                          <div
                            key={line.label}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "8px 0",
                              borderBottom: i < (indiaDuty?.length ?? 0) - 1 ? "1px solid var(--border)" : "none",
                              fontSize: 13,
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)" }}>{line.label}</span>
                            <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--text)" }}>
                              ${line.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--accent-light)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{t("popup.landed.cost")}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>
                          {Number(indiaDutyResult.landedCost).toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                      {totalIncidence != null && (
                        <div
                          style={{
                            padding: "12px 16px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-elevated)",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("popup.total")}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                            ~{totalIncidence.toFixed(1)}%
                          </div>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {t("popup.fx", { rate: indiaDutyResult.exchangeRate, currency: indiaDutyResult.currency, date: indiaDutyResult.effectiveDate })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                  {t("popup.duty.note")}
                </p>
              )}
            </div>
          </div>
        )}

        {uae && (
          <div style={{ padding: "0 20px 20px" }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Calculator style={{ width: 18, height: 18, color: "var(--accent)" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                  {t("popup.calculator")} — UAE
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{t("popup.cif")}</span>
                  <input
                    className="input"
                    type="number"
                    value={cif}
                    onChange={(e) => setCif(Number(e.target.value))}
                    style={{ height: 40 }}
                  />
                </label>
                <button className="btn-secondary" type="button" onClick={() => setCif(10000)} style={{ height: 40 }}>
                  {t("popup.reset")}
                </button>
              </div>

              {uaeDutyResult ? (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                    }}
                    className="detail-split-responsive"
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                        {t("popup.uae.breakdown")}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {uaeDuty?.map((line, i) => (
                          <div
                            key={line.label}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "8px 0",
                              borderBottom: i < (uaeDuty?.length ?? 0) - 1 ? "1px solid var(--border)" : "none",
                              fontSize: 13,
                            }}
                          >
                            <span style={{ color: "var(--text-secondary)" }}>{line.label}</span>
                            <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--text)" }}>
                              ${line.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 14px",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--accent-light)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{t("popup.landed.cost")}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>
                          {Number(uaeDutyResult.landedCost).toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
                      {uaeTotalIncidence != null && (
                        <div
                          style={{
                            padding: "12px 16px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-elevated)",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("popup.total")}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                            ~{uaeTotalIncidence.toFixed(1)}%
                          </div>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {t("popup.fx", { rate: uaeDutyResult.exchangeRate, currency: uaeDutyResult.currency, date: uaeDutyResult.effectiveDate })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                  {t("popup.duty.note")}
                </p>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: china && india && uae ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
            gap: 16,
            padding: "0 20px 20px",
          }}
          className="detail-split-responsive"
        >
          {china && <CompliancePanel code={china} />}
          {india && <CompliancePanel code={india} />}
          {uae && <CompliancePanel code={uae} />}
        </div>

        <div style={{ padding: "0 20px 20px" }}>
          <DutyDisclaimer />
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .detail-split-responsive {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
