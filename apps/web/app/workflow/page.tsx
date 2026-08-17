"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, ArrowRight, Loader2, Package, FileText, Truck, Ship, Plane, ArrowUpDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { useTranslation } from "../../lib/i18n";
import { api } from "../../lib/api";
import type { CodeResult } from "../../lib/shared-types";
import { DUTY_DISCLAIMER_TEXT } from "../../lib/shared-types";

/* ─── types ─── */
type TradeRoute = { fromPort: { code: string; name: string; city: string; country: string }; toPort: { code: string; name: string; city: string; country: string }; mode: "sea" | "air"; startedAt: string };

type MatchResult = { rows: CodeResult[]; matchConfidence: string };

type DocForm = {
  sellerName: string; sellerAddress: string; buyerName: string; buyerAddress: string;
  quantity: number; unit: string; unitPrice: number; packages: number;
  lengthCm: number; widthCm: number; heightCm: number; grossWeightKg: number;
};

const STEPS = ["route", "code", "compare", "documents", "freight"] as const;
const STEP_KEYS = ["workflow.step.route", "workflow.step.code", "workflow.step.compare", "workflow.step.documents", "workflow.step.freight"] as const;

/* ─── freight estimate bands ─── */
function estimateFreight(from: string, to: string, mode: string, shipmentType: string, cbm: number, weightKg: number): string | null {
  const key = [from, to].sort().join("->");
  if (mode === "air") {
    const perKg: Record<string, [number, number]> = { "CN->IN": [3.5, 6], "CN->AE": [2.5, 4.5], "IN->AE": [2, 3.5] };
    const r = perKg[key]; if (!r) return null;
    const low = (weightKg * r[0]).toFixed(0); const high = (weightKg * r[1]).toFixed(0);
    return `$${low} – $${high}`;
  }
  const seaRates: Record<string, Record<string, [number, number]>> = {
    "CN->IN": { lcl: [35, 55], fcl20: [800, 1400], fcl40: [1200, 2000] },
    "CN->AE": { lcl: [25, 45], fcl20: [600, 1000], fcl40: [900, 1500] },
    "IN->AE": { lcl: [30, 50], fcl20: [700, 1100], fcl40: [1000, 1600] },
  };
  const r = seaRates[key]?.[shipmentType]; if (!r) return null;
  if (shipmentType === "lcl") { const low = (cbm * r[0]).toFixed(0); const high = (cbm * r[1]).toFixed(0); return `$${low} – $${high}`; }
  return `$${r[0]} – $${r[1]}`;
}

/* ─── step indicator ─── */
function StepIndicator({ current, t }: { current: number; t: (k: any) => string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "24px 0 16px", flexWrap: "wrap" }}>
      {STEPS.map((_, i) => {
        const done = i < current - 1; const active = i === current - 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              background: done ? "var(--accent)" : active ? "var(--accent-light)" : "var(--bg-elevated)",
              color: done ? "var(--accent-text, #fff)" : active ? "var(--accent)" : "var(--text-muted)",
              border: active ? "2px solid var(--accent)" : "1.5px solid var(--border)",
            }}>
              {done ? <Check style={{ width: 16, height: 16 }} /> : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--text)" : "var(--text-muted)", marginLeft: 6, marginRight: 16, whiteSpace: "nowrap" }}>
              {t(STEP_KEYS[i])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 2 — Code Identification
   ═══════════════════════════════════════════ */
function Step2Code({ route, onComplete }: { route: TradeRoute; onComplete: (codes: any) => void }) {
  const { t } = useTranslation();
  const [option, setOption] = useState<"A" | "B" | "C" | null>(null);
  const [hsInput, setHsInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classifyResults, setClassifyResults] = useState<any[]>([]);

  const originCountry = route.fromPort.country as "CN" | "IN" | "AE";
  const destCountry = route.toPort.country as "CN" | "IN" | "AE";

  async function lookupCode(code: string, country: "CN" | "IN" | "AE", isOrigin: boolean) {
    setLoading(true); setError("");
    try {
      const data = await api.code(country, code);
      const match = await api.match(code, country);
      const row = match[0] ?? null;

      if (isOrigin) {
        const destKey = destCountry.toLowerCase() as "china" | "india" | "uae";
        const closestKey = (`closest${destKey.charAt(0).toUpperCase() + destKey.slice(1)}`) as "closestChina" | "closestIndia" | "closestUae";
        const destExact = row?.[destKey] ?? null;
        const destClosest = row?.[closestKey] ?? null;
        const destData = destExact || destClosest || null;
        onComplete({
          originCode: data?.hsCode ?? code, originCodeData: data,
          destinationCode: destData?.hsCode ?? "", destinationCodeData: destData,
        });
      } else {
        const originKey = originCountry.toLowerCase() as "china" | "india" | "uae";
        const closestKey = (`closest${originKey.charAt(0).toUpperCase() + originKey.slice(1)}`) as "closestChina" | "closestIndia" | "closestUae";
        const originExact = row?.[originKey] ?? null;
        const originClosest = row?.[closestKey] ?? null;
        const originData = originExact || originClosest || null;
        onComplete({
          originCode: originData?.hsCode ?? "", originCodeData: originData,
          destinationCode: data?.hsCode ?? code, destinationCodeData: data,
        });
      }
    } catch { setError(t("step2.error.codeNotFound", { country })); setLoading(false); }
  }

  async function classifyProduct() {
    setLoading(true); setError("");
    try {
      const res = await api.classify({ description: descInput, country: originCountry, lang: "en" });
      setClassifyResults((res.results ?? []).slice(0, 5));
    } catch { setError(t("step2.error.classifyFailed")); }
    setLoading(false);
  }

  async function selectClassified(item: any) {
    setLoading(true); setError("");
    try {
      const match = await api.match(item.hsCode, originCountry);
      const row = match[0] ?? null;
      const destKey = destCountry.toLowerCase() as "china" | "india" | "uae";
      const closestKey = (`closest${destKey.charAt(0).toUpperCase() + destKey.slice(1)}`) as "closestChina" | "closestIndia" | "closestUae";
      const destExact = row?.[destKey] ?? null;
      const destClosest = row?.[closestKey] ?? null;
      const destData = destExact || destClosest || null;
      onComplete({
        originCode: item.hsCode, originCodeData: { ...item, country: originCountry },
        destinationCode: destData?.hsCode ?? "", destinationCodeData: destData ?? null,
      });
    } catch { setError("Match failed."); setLoading(false); }
  }

  return (
    <div style={{ width: "60%", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>{t("step2.title")}</h2>

      {/* Option cards */}
      {[
        { key: "A" as const, titleKey: "step2.optionA.title" as const, descKey: "step2.optionA.desc" as const, country: originCountry },
        { key: "B" as const, titleKey: "step2.optionB.title" as const, descKey: "step2.optionB.desc" as const, country: destCountry },
        { key: "C" as const, titleKey: "step2.optionC.title" as const, descKey: "step2.optionC.desc" as const, country: null },
      ].map(o => (
        <button key={o.key} onClick={() => { setOption(o.key); setError(""); setClassifyResults([]); }}
          className="card" style={{
            display: "block", width: "100%", textAlign: "left", padding: 20, marginBottom: 12,
            border: `1.5px solid ${option === o.key ? "var(--accent)" : "var(--border)"}`,
            background: option === o.key ? "var(--accent-light)" : "var(--bg-card)",
            cursor: "pointer", transition: "all 0.15s",
          }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {t(o.titleKey, { country: o.country ?? "" })}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{t(o.descKey)}</div>
        </button>
      ))}

      {/* Input area */}
      {option === "A" && (
        <div style={{ marginTop: 8 }}>
          <input className="input" value={hsInput} onChange={e => setHsInput(e.target.value)} placeholder={t("step2.optionA.placeholder")} style={{ width: "100%", fontSize: 15, padding: "12px 14px" }} />
          <button className="btn-primary" onClick={() => lookupCode(hsInput, originCountry, true)} disabled={!hsInput.trim() || loading}
            style={{ marginTop: 12, padding: "10px 24px", fontSize: 14 }}>{loading ? t("step2.loading") : t("step2.lookup")}</button>
        </div>
      )}
      {option === "B" && (
        <div style={{ marginTop: 8 }}>
          <input className="input" value={hsInput} onChange={e => setHsInput(e.target.value)} placeholder={t("step2.optionA.placeholder")} style={{ width: "100%", fontSize: 15, padding: "12px 14px" }} />
          <button className="btn-primary" onClick={() => lookupCode(hsInput, destCountry, false)} disabled={!hsInput.trim() || loading}
            style={{ marginTop: 12, padding: "10px 24px", fontSize: 14 }}>{loading ? t("step2.loading") : t("step2.lookup")}</button>
        </div>
      )}
      {option === "C" && (
        <div style={{ marginTop: 8 }}>
          <textarea className="input" value={descInput} onChange={e => setDescInput(e.target.value)} placeholder={t("step2.optionC.placeholder")}
            style={{ width: "100%", fontSize: 15, padding: "12px 14px", minHeight: 100, resize: "vertical" }} />
          <button className="btn-primary" onClick={classifyProduct} disabled={!descInput.trim() || loading}
            style={{ marginTop: 12, padding: "10px 24px", fontSize: 14 }}>{loading ? t("step2.loading") : t("step2.classify")}</button>
          {classifyResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{t("step2.selectCode")}</div>
              {classifyResults.map((item: any, i: number) => (
                <button key={i} onClick={() => selectClassified(item)} disabled={loading}
                  className="card" style={{ display: "block", width: "100%", textAlign: "left", padding: 14, marginBottom: 8, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{item.hsCode}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{item.descriptionEn}</div>
                  {item.confidence != null && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.confidence}% confidence</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--error-light)", color: "var(--error)", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 3 — Compare
   ═══════════════════════════════════════════ */
function Step3Compare({ route, codes, onComplete }: { route: TradeRoute; codes: any; onComplete: (c: any) => void }) {
  const { t } = useTranslation();
  const [originData, setOriginData] = useState<CodeResult | null>(codes.originCodeData);
  const [destData, setDestData] = useState<CodeResult | null>(codes.destinationCodeData);
  const [cif, setCif] = useState(1000);
  const [originDuty, setOriginDuty] = useState<any>(null);
  const [destDuty, setDestDuty] = useState<any>(null);
  const [estimating, setEstimating] = useState<string | null>(null);

  useEffect(() => {
    if (originData?.hsCode && originData?.dutyRate == null) return;
    if (originData) api.duty({ country: originData.country as "CN"|"IN"|"AE", hsCode: originData.hsCode, cifUsd: cif, landingChargesUsd: 0 }).then(setOriginDuty).catch(() => {});
    if (destData) api.duty({ country: destData.country as "CN"|"IN"|"AE", hsCode: destData.hsCode, cifUsd: cif, landingChargesUsd: 0 }).then(setDestDuty).catch(() => {});
  }, [originData?.hsCode, destData?.hsCode, cif]);

  async function estimateRate(country: "CN" | "IN", hsCode: string, which: "origin" | "dest") {
    setEstimating(which);
    try {
      const res = await api.estimateRate({ country, hsCode });
      if (res.rate != null) {
        const updated: CodeResult = which === "origin"
          ? { ...originData!, dutyRate: res.rate }
          : { ...destData!, dutyRate: res.rate };
        if (which === "origin") setOriginData(updated); else setDestData(updated);
      }
    } catch {}
    setEstimating(null);
  }

  function renderColumn(data: CodeResult | null, label: string, which: "origin" | "dest", duty: any) {
    const isEst = data?.dataSource?.includes("gemini-estimate");
    const isClosest = (data as any)?.confidenceLabel != null;
    return (
      <div className="card" style={{ flex: 1, padding: 20, minWidth: 260, borderStyle: isClosest ? "dashed" : undefined, borderColor: isClosest ? "var(--warning)" : undefined }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
        {data ? (
          <>
            {isClosest && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--warning)", marginBottom: 6, padding: "4px 8px", background: "var(--warning-light)", borderRadius: "var(--radius-sm)", display: "inline-block" }}>
                {(data as any).confidenceLabel}
              </div>
            )}
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{data.hsCode}</div>
            <p style={{ margin: "6px 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{data.descriptionEn}</p>
            {data.descriptionLocal && <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{data.descriptionLocal}</p>}

            {data.dutyRate != null ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>{data.country === "CN" ? "MFN" : "BCD"}</span>
                  <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                    {data.dutyRate}%
                    {isEst && <span title={t("rate.est.tooltip")} style={{ fontSize: 10, color: "var(--warning)", marginLeft: 4, cursor: "help" }}>{t("rate.est")}</span>}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--warning-light)", fontSize: 13 }}>
                {t("step3.rateUnavailable")}
                <button onClick={() => estimateRate(data.country as "CN"|"IN", data.hsCode, which)} disabled={estimating === which}
                  style={{ display: "block", marginTop: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>
                  {estimating === which ? t("step3.estimating") : t("step3.estimateAi")}
                </button>
              </div>
            )}

            {duty && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                {duty.lines.map((l: any) => <div key={l.label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span>{l.label}</span><span style={{ fontFamily: "monospace" }}>${l.amount.toFixed(2)}</span></div>)}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 4, fontWeight: 700 }}>
                  <span>{t("popup.landed.cost")}</span><span style={{ fontFamily: "monospace" }}>${duty.landedCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("compare.no.data")}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "60%", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>{t("step3.title")}</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {renderColumn(originData, t("step3.origin", { country: route.fromPort.country }), "origin", originDuty)}
        {renderColumn(destData, t("step3.destination", { country: route.toPort.country }), "dest", destDuty)}
      </div>

      {/* Shared CIF input */}
      <div className="card" style={{ marginTop: 16, padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>CIF (USD)</label>
        <input className="input" type="number" value={cif} onChange={e => setCif(Number(e.target.value) || 0)}
          style={{ width: 120, fontSize: 14, padding: "8px 10px" }} />
      </div>

      <button className="btn-primary" onClick={() => onComplete({ originCode: codes.originCode, destinationCode: codes.destinationCode, originCodeData: originData, destinationCodeData: destData })}
        style={{ marginTop: 20, padding: "12px 28px", fontSize: 14 }}>
        {t("step3.continue")} <ArrowRight style={{ width: 16, height: 16, marginLeft: 6, verticalAlign: "middle" }} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 4 — Documents
   ═══════════════════════════════════════════ */
function Step4Documents({ route, codes, onComplete }: { route: TradeRoute; codes: any; onComplete: (d: DocForm) => void }) {
  const { t } = useTranslation();
  const saved = typeof window !== "undefined" ? JSON.parse(sessionStorage.getItem("tradedocs") || "null") : null;
  const [form, setForm] = useState<DocForm>(saved ?? {
    sellerName: "", sellerAddress: "", buyerName: "", buyerAddress: "",
    quantity: 1, unit: "pieces", unitPrice: 0, packages: 1,
    lengthCm: 0, widthCm: 0, heightCm: 0, grossWeightKg: 0,
  });

  const set = useCallback((k: keyof DocForm, v: any) => setForm(prev => ({ ...prev, [k]: v })), []);
  const totalValue = useMemo(() => form.quantity * form.unitPrice, [form.quantity, form.unitPrice]);
  const totalCbm = useMemo(() => form.packages * (form.lengthCm * form.widthCm * form.heightCm / 1_000_000), [form]);
  const totalGross = useMemo(() => form.packages * form.grossWeightKg, [form]);

  useEffect(() => { sessionStorage.setItem("tradedocs", JSON.stringify(form)); }, [form]);

  const invoiceValid = form.sellerName.trim() !== "" && form.sellerAddress.trim() !== "" &&
    form.buyerName.trim() !== "" && form.buyerAddress.trim() !== "" &&
    form.quantity > 0 && form.unitPrice > 0;
  const packingValid = invoiceValid && form.packages > 0 &&
    form.lengthCm > 0 && form.widthCm > 0 && form.heightCm > 0 && form.grossWeightKg > 0;
  const allValid = packingValid;
  const anyEmpty = !invoiceValid;

  function generateInvoice() {
    const doc = new jsPDF();
    const inv = "TC-" + Date.now();
    let y = 15;
    doc.setFontSize(18); doc.text("COMMERCIAL INVOICE", 105, y, { align: "center" }); y += 10;
    doc.setFontSize(10); doc.text(`Invoice No: ${inv}`, 10, y); doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y); y += 10;
    doc.setFontSize(11);
    doc.text("Seller:", 10, y); doc.text("Buyer:", 110, y); y += 6;
    doc.setFontSize(10);
    doc.text(form.sellerName || "—", 10, y); doc.text(form.buyerName || "—", 110, y); y += 5;
    doc.text(form.sellerAddress || "—", 10, y, { maxWidth: 85 }); doc.text(form.buyerAddress || "—", 110, y, { maxWidth: 85 }); y += 12;
    doc.setFontSize(11); doc.text("Shipment Details", 10, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Origin: ${route.fromPort.name} (${route.fromPort.code})  |  Destination: ${route.toPort.name} (${route.toPort.code})  |  Mode: ${route.mode}`, 10, y); y += 10;
    doc.setFontSize(11); doc.text("Line Items", 10, y); y += 7;
    doc.setFontSize(10);
    const hdr = ["HS Code", "Description", "Qty", "Unit", "Unit Price", "Total"];
    const widths = [25, 65, 20, 20, 25, 25];
    let x = 10;
    hdr.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; }); y += 5;
    doc.line(10, y, 200, y); y += 5;
    x = 10;
    const desc = codes.originCodeData?.descriptionEn ?? "";
    const row = [codes.originCode ?? "", desc.slice(0, 40), String(form.quantity), form.unit, `$${form.unitPrice.toFixed(2)}`, `$${totalValue.toFixed(2)}`];
    row.forEach((r, i) => { doc.text(r, x, y); x += widths[i]; }); y += 10;
    doc.setFontSize(11); doc.text(`Total Value: USD ${totalValue.toFixed(2)}`, 10, y); y += 15;
    doc.setFontSize(8); doc.text(DUTY_DISCLAIMER_TEXT, 10, y, { maxWidth: 190 }); y += 12;
    doc.text("Generated by TradeCode Pro — tradecode-pro.vercel.app", 105, 285, { align: "center" });
    doc.save(`commercial-invoice-${inv}.pdf`);
  }

  function generatePackingList() {
    const doc = new jsPDF();
    const inv = "TC-" + Date.now();
    let y = 15;
    doc.setFontSize(18); doc.text("PACKING LIST", 105, y, { align: "center" }); y += 10;
    doc.setFontSize(10); doc.text(`Ref: ${inv}`, 10, y); doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y); y += 10;
    doc.setFontSize(11); doc.text("Shipment Details", 10, y); y += 7;
    doc.setFontSize(10);
    doc.text(`Origin: ${route.fromPort.name}  |  Destination: ${route.toPort.name}  |  Mode: ${route.mode}`, 10, y); y += 7;
    doc.text(`HS Code: ${codes.originCode ?? "—"}  |  ${codes.originCodeData?.descriptionEn ?? ""}`, 10, y); y += 10;
    doc.setFontSize(11); doc.text("Package Details", 10, y); y += 7;
    doc.setFontSize(10);
    const hdr = ["#", "Dimensions (cm)", "Gross Wt", "Net Wt", "CBM"];
    const widths = [10, 50, 30, 30, 30];
    let x = 10;
    hdr.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; }); y += 5;
    doc.line(10, y, 200, y); y += 5;
    const cbmEach = (form.lengthCm * form.widthCm * form.heightCm / 1_000_000);
    for (let i = 1; i <= Math.min(form.packages, 20); i++) {
      x = 10;
      const row = [String(i), `${form.lengthCm}×${form.widthCm}×${form.heightCm}`, `${form.grossWeightKg} kg`, `${form.grossWeightKg} kg`, cbmEach.toFixed(4)];
      row.forEach((r, j) => { doc.text(r, x, y); x += widths[j]; }); y += 5;
    }
    y += 5; doc.line(10, y, 200, y); y += 5;
    doc.setFontSize(10);
    doc.text(`Total Packages: ${form.packages}   |   Total CBM: ${totalCbm.toFixed(4)}   |   Total Gross Weight: ${totalGross.toFixed(1)} kg`, 10, y); y += 15;
    doc.setFontSize(8); doc.text(DUTY_DISCLAIMER_TEXT, 10, y, { maxWidth: 190 }); y += 12;
    doc.text("Generated by TradeCode Pro — tradecode-pro.vercel.app", 105, 285, { align: "center" });
    doc.save(`packing-list-${inv}.pdf`);
  }

  const unitOptions = ["pieces", "kg", "cartons", "sets", "pairs"];
  const unitKeys: Record<string, string> = { pieces: "step4.unit.pieces", kg: "step4.unit.kg", cartons: "step4.unit.cartons", sets: "step4.unit.sets", pairs: "step4.unit.pairs" };
  const CountryNames: Record<string, string> = { CN: t("common.china"), IN: t("common.india"), AE: t("common.uae") };

  return (
    <div style={{ width: "60%", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>{t("step4.title")}</h2>

      {/* Pre-filled read-only */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.hsCodeOrigin")}: </span><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{codes.originCode}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.hsCodeDest")}: </span><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{codes.destinationCode}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.originPort")}: </span>{route.fromPort.name}</div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.destinationPort")}: </span>{route.toPort.name}</div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.countryOfOrigin")}: </span>{CountryNames[route.fromPort.country] ?? route.fromPort.country}</div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.invoiceDate")}: </span>{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Editable form */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          {[
            { label: t("step4.seller") + " " + t("step4.name"), k: "sellerName" as const, type: "text", col: 1 },
            { label: t("step4.buyer") + " " + t("step4.name"), k: "buyerName" as const, type: "text", col: 1 },
            { label: t("step4.seller") + " " + t("step4.address"), k: "sellerAddress" as const, type: "textarea", col: 2 },
            { label: t("step4.buyer") + " " + t("step4.address"), k: "buyerAddress" as const, type: "textarea", col: 2 },
          ].map(f => (
            <div key={f.k} style={{ gridColumn: f.col === 2 ? "span 2" : undefined }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea className="input" value={String(form[f.k])} onChange={e => set(f.k, e.target.value)}
                  style={{ width: "100%", minHeight: 56, fontSize: 13, padding: "8px 10px", resize: "vertical", boxSizing: "border-box" }} />
              ) : (
                <input className="input" value={String(form[f.k])} onChange={e => set(f.k, e.target.value)}
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
              )}
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.quantity")}</label>
            <input className="input" type="number" min={1} value={form.quantity} onChange={e => set("quantity", Number(e.target.value) || 1)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "block" }}>{t("step4.quantity.helper")}</span>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.unit")}</label>
            <select className="input" value={form.unit} onChange={e => set("unit", e.target.value)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }}>
              {unitOptions.map(u => <option key={u} value={u}>{t(unitKeys[u] as any)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.unitPrice")} (USD)</label>
            <input className="input" type="number" min={0} step={0.01} value={form.unitPrice} onChange={e => set("unitPrice", Number(e.target.value) || 0)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.packages")}</label>
            <input className="input" type="number" min={1} value={form.packages} onChange={e => set("packages", Number(e.target.value) || 1)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "block" }}>{t("step4.packages.helper")}</span>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.length")} (cm)</label>
            <input className="input" type="number" min={0} value={form.lengthCm} onChange={e => set("lengthCm", Number(e.target.value) || 0)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.width")} (cm)</label>
            <input className="input" type="number" min={0} value={form.widthCm} onChange={e => set("widthCm", Number(e.target.value) || 0)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.height")} (cm)</label>
            <input className="input" type="number" min={0} value={form.heightCm} onChange={e => set("heightCm", Number(e.target.value) || 0)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{t("step4.grossWeight")} (kg)</label>
            <input className="input" type="number" min={0} step={0.1} value={form.grossWeightKg} onChange={e => set("grossWeightKg", Number(e.target.value) || 0)}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", boxSizing: "border-box" }} />
          </div>
        </div>
      </div>

      {/* Auto-calculated */}
      <div className="card" style={{ padding: 16, marginTop: 12, fontSize: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 16px" }}>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.totalValue")}: </span><b>${totalValue.toFixed(2)}</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.totalCbm")}: </span><b>{totalCbm.toFixed(4)} m³</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.totalGrossWeight")}: </span><b>{totalGross.toFixed(1)} kg</b></div>
        </div>
      </div>

      {/* Validation message */}
      {anyEmpty && (
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--warning-light)", color: "var(--warning)", fontSize: 13 }}>
          {t("step4.validationMessage")}
        </div>
      )}

      {/* PDF buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={generateInvoice} disabled={!invoiceValid} className="btn-primary" title={!invoiceValid ? t("step4.tooltipInvoice") : ""}
          style={{ padding: "10px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: invoiceValid ? 1 : 0.5, cursor: invoiceValid ? "pointer" : "not-allowed" }}>
          <FileText style={{ width: 16, height: 16 }} /> {t("step4.downloadInvoice")}
        </button>
        <button onClick={generatePackingList} disabled={!packingValid} className="btn-primary" title={!packingValid ? t("step4.tooltipPacking") : ""}
          style={{ padding: "10px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: packingValid ? 1 : 0.5, cursor: packingValid ? "pointer" : "not-allowed" }}>
          <Package style={{ width: 16, height: 16 }} /> {t("step4.downloadPacking")}
        </button>
      </div>

      <button className="btn-primary" onClick={() => onComplete(form)} disabled={!allValid}
        style={{ marginTop: 20, padding: "12px 28px", fontSize: 14, opacity: allValid ? 1 : 0.5, cursor: allValid ? "pointer" : "not-allowed" }}>
        {t("step4.continue")} <ArrowRight style={{ width: 16, height: 16, marginLeft: 6, verticalAlign: "middle" }} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 5 — Freight Estimate
   ═══════════════════════════════════════════ */
function Step5Freight({ route, codes, docs }: { route: TradeRoute; codes: any; docs: DocForm }) {
  const { t } = useTranslation();
  const [shipmentType, setShipmentType] = useState("lcl");
  const totalCbm = docs.packages * (docs.lengthCm * docs.widthCm * docs.heightCm / 1_000_000);
  const totalGross = docs.packages * docs.grossWeightKg;

  const estimate = useMemo(() => estimateFreight(route.fromPort.country, route.toPort.country, route.mode, shipmentType, totalCbm, totalGross), [route, shipmentType, totalCbm, totalGross]);

  const seaOptions = [
    { value: "lcl", key: "step5.lcl" as const },
    { value: "fcl20", key: "step5.fcl20" as const },
    { value: "fcl40", key: "step5.fcl40" as const },
    { value: "fcl40hc", key: "step5.fcl40hc" as const },
  ];
  const airOptions = [{ value: "air", key: "step5.airFreight" as const }];
  const options = route.mode === "air" ? airOptions : seaOptions;

  function buildSeaRatesUrl() {
    const base = "https://www.searates.com/services/port-to-port/";
    const params = new URLSearchParams();
    params.set("from_port", route.fromPort.code);
    params.set("to_port", route.toPort.code);
    if (totalGross) params.set("weight", String(Math.round(totalGross)));
    if (totalCbm) params.set("volume", totalCbm.toFixed(2));
    const typeMap: Record<string, string> = { lcl: "lcl", fcl20: "fcl20", fcl40: "fcl40", fcl40hc: "fcl40", air: "lcl" };
    params.set("type", typeMap[shipmentType] ?? "lcl");
    return `${base}?${params}`;
  }

  return (
    <div style={{ width: "60%", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>{t("step5.title")}</h2>

      {/* Read-only summary */}
      <div className="card" style={{ padding: 16, marginBottom: 16, fontSize: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
          <div><span style={{ color: "var(--text-muted)" }}>{t("route.from")}: </span><b>{route.fromPort.code}</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("route.to")}: </span><b>{route.toPort.code}</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.totalCbm")}: </span><b>{totalCbm.toFixed(4)} m³</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("step4.totalGrossWeight")}: </span><b>{totalGross.toFixed(1)} kg</b></div>
          <div><span style={{ color: "var(--text-muted)" }}>{t("route.sea") === "Sea freight" ? "Mode" : "Mode"}: </span><b>{route.mode === "sea" ? t("route.sea") : t("route.air")}</b></div>
        </div>
      </div>

      {/* Shipment type selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{t("step5.shipmentType")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {options.map(o => (
            <button key={o.value} onClick={() => setShipmentType(o.value)}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${shipmentType === o.value ? "var(--accent)" : "var(--border)"}`,
                background: shipmentType === o.value ? "var(--accent-light)" : "var(--bg-input)",
                color: shipmentType === o.value ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.15s",
              }}>
              {t(o.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Estimate display */}
      {estimate && (
        <div className="card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{t("step5.estimate")}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{estimate}</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("step5.indicative")}</p>
        </div>
      )}

      {/* SeaRates CTA */}
      <a href={buildSeaRatesUrl()} target="_blank" rel="noopener noreferrer"
        className="btn-primary" style={{
          display: "block", textAlign: "center", marginTop: 20, padding: "14px 0", fontSize: 15, fontWeight: 700,
          borderRadius: "var(--radius)", textDecoration: "none",
        }}>
        <Truck style={{ width: 18, height: 18, marginRight: 8, verticalAlign: "middle" }} />
        {t("step5.getQuote")}
      </a>

      {/* Start over */}
      <button onClick={() => { sessionStorage.removeItem("traderoute"); sessionStorage.removeItem("tradedocs"); window.location.href = "/workflow"; }}
        style={{
          display: "block", width: "100%", marginTop: 12, padding: "12px 0", fontSize: 14,
          border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg-input)",
          color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600, textAlign: "center",
        }}>
        {t("step5.newShipment")}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP 1 — Route Selection
   ═══════════════════════════════════════════ */
type Port = { code: string; name: string; city: string; country: "CN" | "IN" | "AE"; mode: "sea" | "air" | "both" };

const ALL_PORTS: Port[] = [
  { code: "CNSHA", name: "Shanghai", city: "Shanghai", country: "CN", mode: "sea" },
  { code: "CNYTN", name: "Yantian (Shenzhen)", city: "Shenzhen", country: "CN", mode: "sea" },
  { code: "CNGZH", name: "Nansha (Guangzhou)", city: "Guangzhou", country: "CN", mode: "sea" },
  { code: "CNNBO", name: "Ningbo", city: "Ningbo", country: "CN", mode: "sea" },
  { code: "CNTXG", name: "Tianjin", city: "Tianjin", country: "CN", mode: "sea" },
  { code: "CNTAO", name: "Qingdao", city: "Qingdao", country: "CN", mode: "sea" },
  { code: "CNXMN", name: "Xiamen", city: "Xiamen", country: "CN", mode: "sea" },
  { code: "CNDLC", name: "Dalian", city: "Dalian", country: "CN", mode: "sea" },
  { code: "INNSA", name: "JNPT (Mumbai)", city: "Mumbai", country: "IN", mode: "sea" },
  { code: "INMUN", name: "Mundra", city: "Mundra", country: "IN", mode: "sea" },
  { code: "INMAA", name: "Chennai", city: "Chennai", country: "IN", mode: "sea" },
  { code: "INCCU", name: "Kolkata", city: "Kolkata", country: "IN", mode: "sea" },
  { code: "INCOK", name: "Cochin", city: "Cochin", country: "IN", mode: "sea" },
  { code: "INHAZ", name: "Hazira", city: "Hazira", country: "IN", mode: "sea" },
  { code: "INPAV", name: "Pipavav", city: "Pipavav", country: "IN", mode: "sea" },
  { code: "INTUT", name: "Tuticorin", city: "Tuticorin", country: "IN", mode: "sea" },
  { code: "AEJEA", name: "Jebel Ali (Dubai)", city: "Dubai", country: "AE", mode: "sea" },
  { code: "AEAUH", name: "Khalifa Port (Abu Dhabi)", city: "Abu Dhabi", country: "AE", mode: "sea" },
  { code: "AESHJ", name: "Sharjah", city: "Sharjah", country: "AE", mode: "sea" },
  { code: "PVG", name: "Shanghai Pudong", city: "Shanghai", country: "CN", mode: "air" },
  { code: "PEK", name: "Beijing Capital", city: "Beijing", country: "CN", mode: "air" },
  { code: "CAN", name: "Guangzhou Baiyun", city: "Guangzhou", country: "CN", mode: "air" },
  { code: "SZX", name: "Shenzhen Bao'an", city: "Shenzhen", country: "CN", mode: "air" },
  { code: "BOM", name: "Mumbai", city: "Mumbai", country: "IN", mode: "air" },
  { code: "DEL", name: "Delhi", city: "Delhi", country: "IN", mode: "air" },
  { code: "MAA", name: "Chennai", city: "Chennai", country: "IN", mode: "air" },
  { code: "BLR", name: "Bangalore", city: "Bangalore", country: "IN", mode: "air" },
  { code: "HYD", name: "Hyderabad", city: "Hyderabad", country: "IN", mode: "air" },
  { code: "DXB", name: "Dubai", city: "Dubai", country: "AE", mode: "air" },
  { code: "AUH", name: "Abu Dhabi", city: "Abu Dhabi", country: "AE", mode: "air" },
  { code: "SHJ", name: "Sharjah", city: "Sharjah", country: "AE", mode: "air" },
];

const PORT_FLAGS: Record<string, string> = { CN: "\uD83C\uDDE8\uD83C\uDDF3", IN: "\uD83C\uDDEE\uD83C\uDDF3", AE: "\uD83C\uDDE6\uD83C\uDDEA" };
const PORT_GROUP_LABELS: Record<string, Record<string, string>> = {
  en: { CN: "China", IN: "India", AE: "UAE" },
  zh: { CN: "\u4E2D\u56FD", IN: "\u5370\u5EA6", AE: "\u963F\u8054\u914B" },
  hi: { CN: "China", IN: "India", AE: "UAE" },
};

function PortDropdown({ label, selected, excludedCountry, mode, onSelect, placeholder }: {
  label: string;
  selected: Port | null;
  excludedCountry?: string;
  mode: "sea" | "air";
  onSelect: (p: Port) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { locale, t } = useTranslation();

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = ALL_PORTS.filter(p => {
    if (p.mode !== mode && p.mode !== "both") return false;
    if (excludedCountry && p.country === excludedCountry) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  const groups = new Map<string, Port[]>();
  for (const p of filtered) { const g = groups.get(p.country) ?? []; g.push(p); groups.set(p.country, g); }

  return (
    <div ref={ref} style={{ flex: 1, position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 16px", textAlign: "left", fontSize: 15, fontWeight: 600,
          borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--bg-input)",
          color: selected ? "var(--text)" : "var(--text-muted)", cursor: "pointer", transition: "border-color 0.15s",
          display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{selected.code} — {selected.city}</span>
          </>
        ) : (
          <span>{placeholder}</span>
        )}
      </button>
      {open && (
        <div
          className="glass-elevated"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, marginTop: 4,
            borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: 8,
            maxHeight: 320, overflowY: "auto",
          }}
        >
          <input
            className="input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("route.search.placeholder")}
            autoFocus
            style={{ width: "100%", padding: "8px 12px", fontSize: 13, boxSizing: "border-box", marginBottom: 6 }}
          />
          {filtered.length === 0 && <div style={{ padding: "12px 8px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{t("route.no.results")}</div>}
          {Array.from(groups.entries()).map(([country, ports]) => (
            <div key={country}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "6px 8px 4px", letterSpacing: "0.04em" }}>
                {PORT_FLAGS[country] ?? ""} {PORT_GROUP_LABELS[locale]?.[country] ?? PORT_GROUP_LABELS.en[country] ?? country}
              </div>
              {ports.map(p => (
                <button
                  key={p.code}
                  onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 8px",
                    fontSize: 13, borderRadius: "var(--radius-sm)", border: "none", background: "transparent",
                    cursor: "pointer", color: "var(--text)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: 6, fontFamily: "monospace", fontSize: 12 }}>{p.code}</span>
                  <span style={{ color: "var(--text-faint)", marginLeft: 4, fontSize: 12 }}>{p.city}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step1Route({ onComplete }: { onComplete: (r: TradeRoute) => void }) {
  const [fromPort, setFromPort] = useState<Port | null>(null);
  const [toPort, setToPort] = useState<Port | null>(null);
  const [mode, setMode] = useState<"sea" | "air">("sea");
  const { t } = useTranslation();

  function swapPorts() { setFromPort(toPort); setToPort(fromPort); }

  function handleStart() {
    if (!fromPort || !toPort) return;
    const r: TradeRoute = {
      fromPort: { code: fromPort.code, name: fromPort.name, city: fromPort.city, country: fromPort.country },
      toPort: { code: toPort.code, name: toPort.name, city: toPort.city, country: toPort.country },
      mode,
      startedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("traderoute", JSON.stringify(r));
    onComplete(r);
  }

  return (
    <div style={{ width: "60%", maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4, textAlign: "center" }}>
        {t("route.title")}
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", marginBottom: 24 }}>
        {t("route.subtitle")}
      </p>

      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <PortDropdown
            label={t("route.from")}
            selected={fromPort}
            excludedCountry={toPort?.country}
            mode={mode}
            onSelect={setFromPort}
            placeholder={t("route.select.origin")}
          />
          <button
            onClick={swapPorts}
            title={t("route.swap")}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "1.5px solid var(--border)",
              background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, marginBottom: 2, color: "var(--accent)",
            }}
          >
            <ArrowUpDown style={{ width: 16, height: 16 }} />
          </button>
          <PortDropdown
            label={t("route.to")}
            selected={toPort}
            excludedCountry={fromPort?.country}
            mode={mode}
            onSelect={setToPort}
            placeholder={t("route.select.destination")}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {[
            { value: "sea" as const, icon: Ship, key: "route.sea" as const },
            { value: "air" as const, icon: Plane, key: "route.air" as const },
          ].map(({ value, icon: Icon, key }) => (
            <button
              key={value}
              onClick={() => { setMode(value); setFromPort(null); setToPort(null); }}
              style={{
                flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${mode === value ? "var(--accent)" : "var(--border)"}`,
                background: mode === value ? "var(--accent-light)" : "var(--bg-input)",
                color: mode === value ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.15s",
              }}
            >
              <Icon style={{ width: 15, height: 15 }} /> {t(key)}
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={!fromPort || !toPort}
          className="btn-primary"
          style={{
            width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: "var(--radius)",
            opacity: !fromPort || !toPort ? 0.5 : 1, cursor: !fromPort || !toPort ? "not-allowed" : "pointer",
          }}
        >
          {t("route.start")}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function WorkflowPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [route, setRoute] = useState<TradeRoute | null>(null);
  const [step, setStep] = useState(1);
  const [codes, setCodes] = useState<any>({});
  const [docs, setDocs] = useState<DocForm | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("traderoute");
    if (raw) {
      setRoute(JSON.parse(raw));
      setStep(2);
    }
  }, []);

  function handleRouteStart(r: TradeRoute) {
    setRoute(r);
    setStep(2);
  }

  return (
    <main className="page-shell" style={{ paddingBottom: 80, paddingTop: 24 }}>
      <StepIndicator current={step} t={t} />

      {/* Back button */}
      {step > 1 && (
        <div style={{ width: "60%", maxWidth: 960, margin: "0 auto 12px" }}>
          <button onClick={() => {
            if (step === 2) { setRoute(null); setStep(1); sessionStorage.removeItem("traderoute"); }
            else setStep(s => s - 1);
          }}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> {t("workflow.back")}
          </button>
        </div>
      )}

      {step === 1 && <Step1Route onComplete={handleRouteStart} />}
      {step === 2 && route && <Step2Code route={route} onComplete={(c) => { setCodes(c); setStep(3); }} />}
      {step === 3 && route && <Step3Compare route={route} codes={codes} onComplete={(c) => { setCodes({ ...codes, ...c }); setStep(4); }} />}
      {step === 4 && route && <Step4Documents route={route} codes={codes} onComplete={(d) => { setDocs(d); setStep(5); }} />}
      {step === 5 && route && <Step5Freight route={route} codes={codes} docs={docs!} />}
    </main>
  );
}
