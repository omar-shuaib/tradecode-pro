"use client";

import { Shield, CheckCircle, AlertTriangle, XCircle, Flag } from "lucide-react";
import { useTranslation } from "../lib/i18n";

type Code = {
  country: "CN" | "IN" | "AE";
  requiresLicence?: boolean | null;
  requiresInspection?: boolean | null;
  inspectionAgency?: string | null;
  isRestricted?: boolean | null;
  isProhibited?: boolean | null;
  importPolicy?: string | null;
  supervisoryConditions?: string | null;
};

function FlagChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CheckCircle;
  label: string;
  tone: "good" | "warn" | "bad";
}) {
  const colors = {
    good: {
      bg: "var(--success-light)",
      color: "var(--success)",
    },
    warn: {
      bg: "var(--warning-light)",
      color: "var(--warning)",
    },
    bad: {
      bg: "var(--error-light)",
      color: "var(--error)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 9999,
        backgroundColor: colors[tone].bg,
        color: colors[tone].color,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function CompliancePanel({ code }: { code: Code }) {
  const { t } = useTranslation();
  const flags: { icon: typeof CheckCircle; label: string; tone: "good" | "warn" | "bad" }[] = [];

  if (code.isProhibited) {
    flags.push({ icon: XCircle, label: t("compliance.prohibited"), tone: "bad" });
  }

  if (code.isRestricted) {
    flags.push({ icon: AlertTriangle, label: t("compliance.restricted"), tone: "warn" });
  }

  if (code.requiresLicence) {
    flags.push({ icon: AlertTriangle, label: t("compliance.licence"), tone: "warn" });
  }

  if (code.requiresInspection) {
    flags.push({
      icon: AlertTriangle,
      label: code.inspectionAgency ? `${t("compliance.inspection")}: ${code.inspectionAgency}` : t("compliance.inspection"),
      tone: "warn",
    });
  }

  if (code.importPolicy) {
    flags.push({ icon: Flag, label: `${t("compliance.policy")}: ${code.importPolicy}`, tone: "warn" });
  }

  if (code.supervisoryConditions) {
    flags.push({ icon: Flag, label: `${t("compliance.supervisory")}: ${code.supervisoryConditions}`, tone: "warn" });
  }

  if (flags.length === 0) {
    flags.push({ icon: CheckCircle, label: t("compliance.clear"), tone: "good" });
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Shield style={{ width: 18, height: 18, color: "var(--accent)" }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{t("compliance.title")}</span>
        <span
          className="badge"
          style={{
            marginLeft: "auto",
            backgroundColor:
              code.country === "CN" ? "var(--warning-light)" : code.country === "IN" ? "var(--success-light)" : "#e0f2fe",
            color: code.country === "CN" ? "var(--warning)" : code.country === "IN" ? "var(--success)" : "#0284c7",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {code.country}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {flags.map((f) => (
          <FlagChip key={f.label} icon={f.icon} label={f.label} tone={f.tone} />
        ))}
      </div>
    </div>
  );
}
