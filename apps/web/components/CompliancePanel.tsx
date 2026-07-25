"use client";

import { Shield, CheckCircle, AlertTriangle, XCircle, Flag } from "lucide-react";
import { cn } from "../lib/utils";

type Code = {
  country: "CN" | "IN";
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
  const flags: { icon: typeof CheckCircle; label: string; tone: "good" | "warn" | "bad" }[] = [];

  if (code.isProhibited) {
    flags.push({ icon: XCircle, label: "Prohibited", tone: "bad" });
  }

  if (code.isRestricted) {
    flags.push({ icon: AlertTriangle, label: "Restricted", tone: "warn" });
  }

  if (code.requiresLicence) {
    flags.push({ icon: AlertTriangle, label: "Licence required", tone: "warn" });
  }

  if (code.requiresInspection) {
    flags.push({
      icon: AlertTriangle,
      label: `Inspection required${code.inspectionAgency ? `: ${code.inspectionAgency}` : ""}`,
      tone: "warn",
    });
  }

  if (code.importPolicy) {
    flags.push({ icon: Flag, label: `Import policy: ${code.importPolicy}`, tone: "warn" });
  }

  if (code.supervisoryConditions) {
    flags.push({ icon: Flag, label: `Supervisory: ${code.supervisoryConditions}`, tone: "warn" });
  }

  if (flags.length === 0) {
    flags.push({ icon: CheckCircle, label: "All clear", tone: "good" });
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Shield style={{ width: 18, height: 18, color: "var(--accent)" }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Compliance</span>
        <span
          className="badge"
          style={{
            marginLeft: "auto",
            backgroundColor:
              code.country === "CN" ? "var(--warning-light)" : "var(--success-light)",
            color: code.country === "CN" ? "var(--warning)" : "var(--success)",
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
