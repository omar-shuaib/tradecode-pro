"use client";

import { useState } from "react";
import { DUTY_DISCLAIMER_TEXT } from "../lib/shared-types";
import { useTranslation } from "../lib/i18n";

type CountryCode = "CN" | "IN" | "AE";

/** One HS code as it appears in a report, whatever shape the caller's data had. */
type ReportRow = {
  country: CountryCode | "";
  hsCode: string;
  descriptionEn: string;
  descriptionLocal: string;
  dutyRate: number | null;
  secondaryRate: number | null;
  requiresLicence: boolean;
  requiresInspection: boolean;
  isRestricted: boolean;
  isProhibited: boolean;
  importPolicy: string;
  supervisoryConditions: string;
  dataSource: string;
  /** "Exact record" or "Closest match", so approximate matches are never mistaken for the real code. */
  matchType: string;
  confidence: number | null;
};

const COUNTRY_NAME: Record<string, string> = { CN: "China", IN: "India", AE: "UAE" };
const RATE_LABELS: Record<string, [string, string]> = {
  CN: ["MFN duty", "Import VAT"],
  IN: ["BCD", "IGST"],
  AE: ["Customs duty", "VAT"],
};

function isCodeLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && typeof (v as any).hsCode === "string" && typeof (v as any).descriptionEn === "string";
}

function toRow(v: Record<string, unknown>, country: CountryCode | "", matchType: string): ReportRow {
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  return {
    country: (str(v.country) as CountryCode) || country,
    hsCode: str(v.hsCode),
    descriptionEn: str(v.descriptionEn),
    descriptionLocal: str(v.descriptionLocal),
    dutyRate: num(v.dutyRate),
    secondaryRate: num(v.secondaryRate),
    requiresLicence: v.requiresLicence === true,
    requiresInspection: v.requiresInspection === true,
    isRestricted: v.isRestricted === true,
    isProhibited: v.isProhibited === true,
    importPolicy: str(v.importPolicy),
    supervisoryConditions: str(v.supervisoryConditions),
    dataSource: str(v.dataSource),
    matchType,
    confidence: num(v.confidence),
  };
}

/**
 * The three callers pass different shapes: a single code, a classify response
 * ({ results: [...] }) and a comparison ({ code, match: { china, india, uae,
 * closestChina, ... } }). Walk whatever arrives and collect every HS code in it.
 */
function collectRows(data: unknown): ReportRow[] {
  const rows: ReportRow[] = [];
  const seen = new Set<string>();
  const hints: Record<string, [CountryCode, string]> = {
    china: ["CN", "Exact record"],
    india: ["IN", "Exact record"],
    uae: ["AE", "Exact record"],
    closestChina: ["CN", "Closest match"],
    closestIndia: ["IN", "Closest match"],
    closestUae: ["AE", "Closest match"],
  };
  const visit = (v: unknown, country: CountryCode | "", matchType: string, depth: number) => {
    if (!v || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) return v.forEach((item) => visit(item, country, matchType, depth + 1));
    if (isCodeLike(v)) {
      const row = toRow(v, country, matchType);
      const key = `${row.country}:${row.hsCode}:${row.matchType}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row);
      }
      return;
    }
    for (const [key, child] of Object.entries(v)) {
      const hint = hints[key];
      visit(child, hint?.[0] ?? country, hint?.[1] ?? matchType, depth + 1);
    }
  };
  visit(data, "", "", 0);
  return rows;
}

function rateText(rate: number | null, dataSource: string): string {
  if (rate == null) return "not on file";
  return `${rate}%${dataSource.includes("gemini-estimate") ? " (AI estimate)" : ""}`;
}

function flagsText(r: ReportRow): string {
  const flags = [
    r.isProhibited && "Prohibited",
    r.isRestricted && "Restricted",
    r.requiresLicence && "Licence required",
    r.requiresInspection && "Inspection required",
  ].filter(Boolean);
  return flags.length ? flags.join(", ") : "None recorded";
}

/** jsPDF's built-in fonts only cover Latin-1; anything else would print as garbage. */
function latin(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// jsPDF and SheetJS are large, so they are only downloaded when an export button is clicked.
async function buildPdf(rows: ReportRow[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const left = 14;
  const width = 182;
  const bottom = 262;
  let y = 0;

  const header = () => {
    doc.setFillColor(47, 79, 62);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("TradeCode Pro", left, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("HS Classification Report", left, 18);
    doc.text(`Generated ${stamp()}`, 196, 18, { align: "right" });
    doc.setTextColor(20, 20, 20);
    y = 34;
  };
  const ensure = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage();
      header();
    }
  };
  const field = (label: string, value: string) => {
    const lines = doc.splitTextToSize(latin(value) || "-", width - 44) as string[];
    ensure(lines.length * 4.6 + 1.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(label, left, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(lines, left + 44, y);
    y += lines.length * 4.6 + 1.5;
  };

  header();
  if (!rows.length) {
    doc.setFontSize(11);
    doc.text("No HS codes were available to export.", left, y);
  }
  for (const r of rows) {
    ensure(34);
    const [dutyLabel, secondaryLabel] = RATE_LABELS[r.country] ?? ["Duty", "Secondary tax"];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${COUNTRY_NAME[r.country] ?? "HS code"}  ${r.hsCode}`, left, y);
    if (r.matchType === "Closest match") {
      doc.setFontSize(9);
      doc.setTextColor(170, 100, 0);
      doc.text(`CLOSEST MATCH${r.confidence != null ? ` - ${Math.round(r.confidence)}% confidence` : ""} - verify before use`, 196, y, { align: "right" });
      doc.setTextColor(20, 20, 20);
    }
    y += 6.5;
    field("Description", r.descriptionEn);
    field(dutyLabel, rateText(r.dutyRate, r.dataSource));
    field(secondaryLabel, rateText(r.secondaryRate, r.dataSource));
    field("Compliance flags", flagsText(r));
    if (r.importPolicy) field("Import policy", r.importPolicy);
    if (r.supervisoryConditions) field("Supervisory conditions", r.supervisoryConditions);
    if (r.matchType !== "Closest match" && r.confidence != null) field("Match confidence", `${Math.round(r.confidence)}%`);
    field("Data source", r.dataSource || "Not recorded");
    y += 2;
    doc.setDrawColor(215, 215, 215);
    doc.line(left, y, left + width, y);
    y += 8;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(doc.splitTextToSize(DUTY_DISCLAIMER_TEXT, width) as string[], left, 272);
    doc.text(`Page ${p} of ${pages}`, 196, 290, { align: "right" });
  }
  doc.save(`tradecode-report-${stamp()}.pdf`);
}

async function buildCsv(rows: ReportRow[]) {
  const XLSX = await import("xlsx");
  const table = rows.map((r) => {
    const [dutyLabel, secondaryLabel] = RATE_LABELS[r.country] ?? ["Duty", "Secondary tax"];
    return {
      Country: COUNTRY_NAME[r.country] ?? "",
      "HS code": r.hsCode,
      Description: r.descriptionEn,
      "Local description": r.descriptionLocal,
      "Duty type": dutyLabel,
      "Duty rate %": r.dutyRate ?? "",
      "Secondary tax type": secondaryLabel,
      "Secondary tax rate %": r.secondaryRate ?? "",
      "Rate is AI estimate": r.dataSource.includes("gemini-estimate") ? "Yes" : "No",
      "Licence required": r.requiresLicence ? "Yes" : "No",
      "Inspection required": r.requiresInspection ? "Yes" : "No",
      Restricted: r.isRestricted ? "Yes" : "No",
      Prohibited: r.isProhibited ? "Yes" : "No",
      "Import policy": r.importPolicy,
      "Supervisory conditions": r.supervisoryConditions,
      "Match type": r.matchType,
      "Confidence %": r.confidence != null ? Math.round(r.confidence) : "",
      "Data source": r.dataSource,
    };
  });
  const sheet = XLSX.utils.json_to_sheet(table);
  // HS codes have leading zeros ("01012100"); keep them as text.
  for (let i = 0; i < table.length; i++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
    if (cell) cell.t = "s";
  }
  XLSX.utils.sheet_add_aoa(sheet, [[], [`Generated ${stamp()} by TradeCode Pro. ${DUTY_DISCLAIMER_TEXT}`]], { origin: -1 });
  // The BOM makes Excel read the file as UTF-8, so Chinese descriptions survive.
  const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(sheet);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `tradecode-report-${stamp()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ExportMenu({ data }: { data: unknown }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const rows = collectRows(data);
  const disabled = rows.length === 0;

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button className="btn-secondary" type="button" disabled={disabled} onClick={() => buildPdf(rows)}>
        {t("export.pdf")}
      </button>
      <button className="btn-secondary" type="button" disabled={disabled} onClick={() => buildCsv(rows)}>
        {t("export.csv")}
      </button>
      <button className="btn-secondary" type="button" disabled={disabled} onClick={copyJson}>
        {copied ? t("export.copied") : t("export.json")}
      </button>
    </div>
  );
}
