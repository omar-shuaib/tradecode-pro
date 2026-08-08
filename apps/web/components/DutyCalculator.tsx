"use client";
import { useState } from "react";
import type { DutyResponse } from "../lib/shared-types";
import { api } from "../lib/api";
import { DutyDisclaimer } from "./DutyDisclaimer";

export function DutyCalculator({
  country = "IN",
  hsCode = "85371090",
}: {
  country?: "CN" | "IN" | "AE";
  hsCode?: string;
}) {
  const [cif, setCif] = useState(1000);
  const [landing, setLanding] = useState(0);
  const [result, setResult] = useState<DutyResponse>();
  async function calculate() {
    setResult(await api.duty({ country, hsCode, cifUsd: cif, landingChargesUsd: landing }));
  }
  return (
    <section className="card">
      <h2>{country} duty calculator</h2>
      <p className="muted">HS code: {hsCode}</p>
      <label>
        CIF value (USD) <input type="number" value={cif} onChange={(e) => setCif(+e.target.value)} />
      </label>{" "}
      <label>
        Landing charges (USD) <input type="number" value={landing} onChange={(e) => setLanding(+e.target.value)} />
      </label>{" "}
      <button onClick={() => setLanding(cif * 0.01)}>Use 1% estimate</button>{" "}
      <button onClick={calculate}>Calculate</button>
      <p className="muted">Leave at 0 to calculate on CIF only. The 1% preset is a convenience estimate; actual charges may differ.</p>
      {result && (
        <>
          <ul>
            {result.lines.map((l) => (
              <li key={l.label}>
                {l.label}: {l.amount.toFixed(2)}
              </li>
            ))}
          </ul>
          <b>Total landed cost: {result.landedCost.toFixed(2)} USD</b>
          <p className="muted">
            Reference FX: 1 USD = {result.exchangeRate} {result.currency}, effective {result.effectiveDate}
          </p>
          <DutyDisclaimer />
        </>
      )}
    </section>
  );
}
