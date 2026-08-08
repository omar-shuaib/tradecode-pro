import { readFile } from "node:fs/promises";
import { db } from "../db.js";

let cached:
  | {
      at: number;
      rates: Record<string, { rate: number; date: string }>;
    }
  | undefined;

let localIndiaCache: any[] | null = null;
let localChinaCache: any[] | null = null;
let localUaeCache: any[] | null = null;
let candidateCache: any[] | null = null;

async function loadJson<T>(path: string | URL): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

const fixtureRoot = new URL("../../../data/fixtures/", import.meta.url);

async function localIndia() {
  localIndiaCache ??= await loadJson<any[]>(new URL("local-india-seed.json", fixtureRoot));
  return localIndiaCache;
}

async function localChina() {
  localChinaCache ??= await loadJson<any[]>(new URL("local-china-seed.json", fixtureRoot));
  return localChinaCache;
}

async function localUae() {
  localUaeCache ??= await loadJson<any[]>(new URL("local-uae-seed.json", fixtureRoot));
  return localUaeCache;
}

async function candidates() {
  candidateCache ??= await loadJson<any[]>(new URL("unverified-candidates.json", fixtureRoot));
  return candidateCache;
}

async function rates() {
  if (cached && Date.now() - cached.at < 3_600_000) return cached.rates;
  const rows = await db.exchangeRate.findMany();
  const out: Record<string, { rate: number; date: string }> = {};
  for (const row of rows) {
    out[row.toCurrency] = {
      rate: Number(row.rate),
      date: row.effectiveDate.toISOString().slice(0, 10),
    };
  }
  cached = { at: Date.now(), rates: out };
  return out;
}

function pickIndia(code: string) {
  return localIndia().then(async (rows) => {
    const row = rows.find((item) => item.hs_code === code);
    const candidate = (await candidates()).find((item) => item.country === "IN" && item.hs_code === code);
    return row
      ? {
          bcd: Number(row.bcd_rate ?? candidate?.verified_partial_fields?.bcd_rate?.value ?? 0),
          igst: Number(row.igst_rate ?? candidate?.verified_partial_fields?.igst_rate?.value ?? 0),
          importPolicy: row.import_policy ?? candidate?.verified_partial_fields?.import_policy?.value ?? "",
        }
      : null;
  });
}

function pickChina(code: string) {
  return localChina().then(async (rows) => {
    const row = rows.find((item) => item.hs_code_8 === code || item.hs_code === code || item.hs_code_10 === code);
    return row
      ? {
          mfn: Number(row.mfn_duty_rate ?? 0),
          vat: Number(row.vat_rate ?? 0),
        }
      : null;
  });
}

function pickUae(code: string) {
  return localUae().then(async (rows) => {
    const row = rows.find((item) => item.hs_code === code);
    return row
      ? {
          duty: Number(row.customs_duty_rate ?? 5),
          vat: Number(row.vat_rate ?? 5),
        }
      : null;
  });
}

export async function calculate(country: "CN" | "IN" | "AE", hsCode: string, cif: number, landing = 0) {
  const fx = await rates();
  const target = country === "IN" ? "INR" : country === "AE" ? "AED" : "CNY";
  const rate = fx[target] ?? { rate: 1, date: "unknown" };

  if (country === "AE") {
    const row = await db.uaeHsCode.findUnique({ where: { hsCode } }).catch(() => null);
    const fallback = await pickUae(hsCode);
    const dutyRate = Number(row?.customsDutyRate ?? fallback?.duty ?? 5);
    const vatRate = Number(row?.vatRate ?? fallback?.vat ?? 5);
    const customDuty = cif * (dutyRate / 100);
    const vat = (cif + customDuty) * (vatRate / 100);
    const totalDuty = customDuty + vat;
    return {
      country,
      currency: target,
      exchangeRate: rate.rate,
      effectiveDate: rate.date,
      lines: [
        { label: "CIF", amount: cif },
        { label: "Customs Duty", amount: customDuty },
        { label: "VAT base", amount: cif + customDuty },
        { label: "VAT", amount: vat },
      ],
      totalDuty,
      landedCost: cif + totalDuty,
    };
  }

  if (country === "IN") {
    const row = await db.indiaHsCode.findUnique({ where: { hsCode } }).catch(() => null);
    const fallback = await pickIndia(hsCode);
    const bcdRate = Number(row?.bcdRate ?? fallback?.bcd ?? 0);
    const igstRate = Number(row?.igstRate ?? fallback?.igst ?? 0);
    const swsRate = Number(row?.swsRate ?? 10);
    const assessable = cif + landing;
    const bcd = assessable * (bcdRate / 100);
    const sws = bcd * (swsRate / 100);
    const base = assessable + bcd + sws;
    const igst = base * (igstRate / 100);
    const totalDuty = bcd + sws + igst;
    return {
      country,
      currency: target,
      exchangeRate: rate.rate,
      effectiveDate: rate.date,
      lines: [
        { label: "CIF", amount: cif },
        { label: "Landing charges", amount: landing },
        { label: "Assessable value", amount: assessable },
        { label: "BCD", amount: bcd },
        { label: "SWS", amount: sws },
        { label: "IGST base", amount: base },
        { label: "IGST", amount: igst },
      ],
      totalDuty,
      landedCost: assessable + totalDuty,
    };
  }

  const row = await db.chinaHsCode.findUnique({ where: { hsCode8: hsCode } }).catch(() => null);
  const fallback = await pickChina(hsCode);
  const mfnRate = Number(row?.mfnDutyRate ?? fallback?.mfn ?? 0);
  const vatRate = Number(row?.vatRate ?? fallback?.vat ?? 0);
  const mfn = cif * (mfnRate / 100);
  const vat = (cif + mfn) * (vatRate / 100);
  const totalDuty = mfn + vat;
  return {
    country,
    currency: target,
    exchangeRate: rate.rate,
    effectiveDate: rate.date,
    lines: [
      { label: "CIF", amount: cif },
      { label: "MFN", amount: mfn },
      { label: "VAT", amount: vat },
    ],
    totalDuty,
    landedCost: cif + totalDuty,
  };
}
