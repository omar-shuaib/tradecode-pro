import "dotenv/config";
import cors from "cors";
import express from "express";
import { readFile } from "node:fs/promises";
import { rateLimit } from "express-rate-limit";
import { Registry, collectDefaultMetrics } from "prom-client";
import {
  ClassifyRequestSchema,
  CountrySchema,
  DutyRequestSchema,
  ErrorLogSchema,
} from "@tradecode/shared-types";
import { db } from "./db.js";
import { calculate } from "./services/duty.js";
import { createSearchProvider } from "./services/search/index.js";
import { classify } from "./services/gemini.js";

// TODO: monitoring-v2 - adopt Sentry and Grafana Cloud when traffic justifies it.

type LocalIndiaRow = {
  hs_code: string;
  description_en: string;
  description_hi?: string | null;
  chapter: string;
  section?: string | null;
  bcd_rate?: number | null;
  igst_rate?: number | null;
  sws_rate?: number | null;
  import_policy?: string | null;
  requires_licence?: boolean | null;
  requires_inspection?: boolean | null;
  inspection_agency?: string | null;
  is_restricted?: boolean | null;
  is_prohibited?: boolean | null;
  data_source?: string | null;
  last_updated?: string | null;
};

type LocalChinaRow = {
  hs_code_8: string;
  hs_code?: string | null;
  hs_code_10?: string | null;
  chapter: string;
  section?: string | null;
  description_en: string;
  description_zh?: string | null;
  mfn_duty_rate?: number | null;
  vat_rate?: number | null;
  requires_licence?: boolean | null;
  ciq_inspection?: boolean | null;
  is_restricted?: boolean | null;
  is_prohibited?: boolean | null;
  supervisory_conditions?: string | null;
  ciq_codes?: string | null;
  data_source?: string | null;
  last_updated?: string | null;
};

type CandidateRow = {
  country: "CN" | "IN";
  hs_code?: string;
  hs_code_8?: string;
  description_en: string;
  verified_partial_fields?: {
    bcd_rate?: { value: number };
    igst_rate?: { value: number };
    import_policy?: { value: string };
    mfn_duty_rate?: { value: number };
    vat_rate?: { value: number };
    hs_code_10?: { value: string };
  };
};

const app = express();
const search = createSearchProvider();
const registry = new Registry();
collectDefaultMetrics({ register: registry });

app.use(
  cors({ origin: process.env.WEB_ORIGIN ?? "*" }),
  express.json(),
  rateLimit({ windowMs: 60_000, limit: 100 })
);

const localIndiaPath = new URL("../../../data/fixtures/local-india-seed.json", import.meta.url);
const localChinaPath = new URL("../../../data/fixtures/local-china-seed.json", import.meta.url);
const candidatePath = new URL("../../../data/fixtures/unverified-candidates.json", import.meta.url);

let localIndiaCache: LocalIndiaRow[] | null = null;
let localChinaCache: LocalChinaRow[] | null = null;
let candidateCache: CandidateRow[] | null = null;

async function loadJson<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(url, "utf8")) as T;
}

async function localIndia(): Promise<LocalIndiaRow[]> {
  localIndiaCache ??= await loadJson<LocalIndiaRow[]>(localIndiaPath).catch(() => [] as LocalIndiaRow[]);
  if (localIndiaCache.length === 0) {
    localIndiaCache = await db.$queryRaw<LocalIndiaRow[]>`SELECT hs_code, description_en, description_hi, chapter, section, bcd_rate, igst_rate, sws_rate, import_policy, requires_licence, requires_inspection, inspection_agency, is_restricted, is_prohibited, data_source, last_updated::text FROM hs_codes_india`;
  }
  return localIndiaCache;
}

async function localChina(): Promise<LocalChinaRow[]> {
  localChinaCache ??= await loadJson<LocalChinaRow[]>(localChinaPath).catch(() => [] as LocalChinaRow[]);
  if (localChinaCache.length === 0) {
    localChinaCache = await db.$queryRaw<LocalChinaRow[]>`SELECT hs_code_8, hs_code, hs_code_10, chapter, section, description_en, description_zh, mfn_duty_rate, vat_rate, requires_licence, ciq_inspection, is_restricted, is_prohibited, supervisory_conditions, data_source, last_updated::text FROM hs_codes_china`;
  }
  return localChinaCache;
}

async function candidates() {
  candidateCache ??= await loadJson<CandidateRow[]>(candidatePath).catch(() => [] as CandidateRow[]);
  return candidateCache;
}

function mergeIndiaRates(row: LocalIndiaRow) {
  const candidate = candidateCache?.find((item) => item.country === "IN" && item.hs_code === row.hs_code);
  return {
    ...row,
    bcd_rate: row.bcd_rate ?? candidate?.verified_partial_fields?.bcd_rate?.value ?? null,
    igst_rate: row.igst_rate ?? candidate?.verified_partial_fields?.igst_rate?.value ?? null,
    import_policy: row.import_policy ?? candidate?.verified_partial_fields?.import_policy?.value ?? null,
  };
}

function mergeChinaRates(row: LocalChinaRow) {
  const candidate = candidateCache?.find((item) => item.country === "CN" && (item.hs_code_8 ?? item.hs_code) === row.hs_code_8);
  return {
    ...row,
    hs_code_10: row.hs_code_10 ?? candidate?.verified_partial_fields?.hs_code_10?.value ?? null,
    mfn_duty_rate: row.mfn_duty_rate ?? candidate?.verified_partial_fields?.mfn_duty_rate?.value ?? null,
    vat_rate: row.vat_rate ?? candidate?.verified_partial_fields?.vat_rate?.value ?? null,
  };
}

function toSearchResult(row: any, country: "CN" | "IN") {
  if (country === "IN") {
    const merged = row as LocalIndiaRow;
    return {
      country,
      hsCode: merged.hs_code,
      descriptionEn: merged.description_en,
      descriptionLocal: merged.description_hi ?? "",
      chapter: merged.chapter,
      dutyRate: merged.bcd_rate ?? null,
      secondaryRate: merged.igst_rate ?? null,
      requiresLicence: merged.requires_licence ?? false,
      requiresInspection: merged.requires_inspection ?? false,
      isRestricted: merged.is_restricted ?? false,
      isProhibited: merged.is_prohibited ?? false,
      importPolicy: merged.import_policy ?? "",
      inspectionAgency: merged.inspection_agency ?? "",
      supervisoryConditions: "",
      dataSource: merged.data_source ?? "local seed",
      lastUpdated: merged.last_updated ?? "",
    };
  }

  const merged = row as LocalChinaRow;
  return {
    country,
    hsCode: merged.hs_code_8,
    descriptionEn: merged.description_en,
    descriptionLocal: merged.description_zh ?? "",
    chapter: merged.chapter ?? "",
    dutyRate: merged.mfn_duty_rate ?? null,
    secondaryRate: merged.vat_rate ?? null,
    requiresLicence: merged.requires_licence ?? false,
    requiresInspection: merged.ciq_inspection ?? false,
    isRestricted: merged.is_restricted ?? false,
    isProhibited: merged.is_prohibited ?? false,
    importPolicy: "",
    inspectionAgency: "",
    supervisoryConditions: merged.supervisory_conditions ?? "",
    dataSource: merged.data_source ?? "local demo",
    lastUpdated: merged.last_updated ?? "",
  };
}

async function getIndiaCode(code: string) {
  const row = (await localIndia()).find((item) => item.hs_code === code);
  return row ? toSearchResult(mergeIndiaRates(row), "IN") : null;
}

async function getChinaCode(code: string) {
  const row = (await localChina()).find((item) => item.hs_code_8 === code || item.hs_code === code || item.hs_code_10 === code);
  return row ? toSearchResult(mergeChinaRates(row), "CN") : null;
}

async function fallbackSearch(q: string, country: "CN" | "IN" | "BOTH", limit: number) {
  const needle = q.toLowerCase();
  const indiaRows = await localIndia();
  const chinaRows = await localChina();

  const rows = [
    ...indiaRows.map((row) => toSearchResult(mergeIndiaRates(row), "IN")),
    ...chinaRows.map((row) => toSearchResult(mergeChinaRates(row), "CN")),
  ]
    .filter((row) => country === "BOTH" || row.country === country)
    .filter((row) => {
      if (!needle) return true;
      return (
        String(row.hsCode).includes(needle) ||
        String(row.descriptionEn ?? "").toLowerCase().includes(needle) ||
        String(row.descriptionLocal ?? "").toLowerCase().includes(needle)
      );
    });

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.country}-${row.hsCode}-${row.descriptionEn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreMatch(query: string, candidate: string) {
  const qTokens = tokenize(query);
  const cTokens = tokenize(candidate);
  if (!qTokens.length || !cTokens.length) return 0;
  const candidateSet = new Set(cTokens);
  const overlap = qTokens.filter((token) => candidateSet.has(token)).length;
  const exactHit = candidate.includes(query.toLowerCase().trim()) ? 1 : 0;
  const partialHits = qTokens.filter((token) =>
    cTokens.some((ct) => ct.includes(token) || token.includes(ct))
  ).length;
  return (overlap * 0.5 + partialHits * 0.3 + exactHit) / qTokens.length;
}

async function fallbackClassify(description: string, country: "CN" | "IN" | "BOTH", limit: number) {
  const normalized = description.trim();
  const hasMeaningfulToken = tokenize(normalized).length >= 2;
  if (!hasMeaningfulToken) return [];

  const indiaRows = await localIndia();
  const chinaRows = await localChina();

  const allRows = [
    ...indiaRows.map((row) => toSearchResult(mergeIndiaRates(row), "IN")),
    ...chinaRows.map((row) => toSearchResult(mergeChinaRates(row), "CN")),
  ].filter((row) => country === "BOTH" || row.country === country);

  const scored = allRows
    .map((row) => ({
      ...row,
      score: scoreMatch(normalized, `${row.hsCode} ${row.descriptionEn} ${row.descriptionLocal ?? ""}`),
    }))
    .filter((row) => row.score >= 0.1)
    .sort((a, b) => b.score - a.score || Number((b.dutyRate ?? 0) + (b.secondaryRate ?? 0)) - Number((a.dutyRate ?? 0) + (a.secondaryRate ?? 0)));

  if (!scored.length) return [];
  return scored.slice(0, limit).map(({ score: _score, ...row }) => row);
}

app.get("/api/v1/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  const country = CountrySchema.parse(req.query.country ?? "BOTH");

  try {
    const results = await search.search(q, country, 20);
    await db.searchLog.create({ data: { query: q, country, resultCount: results.length } });
    res.json({ results, total: results.length });
  } catch {
    const results = await fallbackSearch(q, country, 20);
    res.json({ results, total: results.length });
  }
});

app.get("/api/v1/autocomplete", async (req, res) => {
  try {
    const results = await search.search(String(req.query.q ?? ""), CountrySchema.parse(req.query.country ?? "BOTH"), 5);
    res.json({ results });
  } catch {
    const results = await fallbackSearch(String(req.query.q ?? ""), CountrySchema.parse(req.query.country ?? "BOTH"), 5);
    res.json({ results });
  }
});

app.get("/api/v1/code/:country/:code", async (req, res) => {
  const country = req.params.country === "CN" ? "CN" : "IN";
  const code = req.params.code;

  if (country === "CN") {
    const dbRow = await db.chinaHsCode.findUnique({ where: { hsCode8: code } }).catch(() => null);
    if (dbRow) {
      return res.json({
        country: "CN",
        hsCode: dbRow.hsCode8,
        descriptionEn: dbRow.descriptionEn,
        descriptionLocal: dbRow.descriptionZh ?? "",
        chapter: dbRow.chapter,
        dutyRate: dbRow.mfnDutyRate ? Number(dbRow.mfnDutyRate) : null,
        secondaryRate: dbRow.vatRate ? Number(dbRow.vatRate) : null,
        requiresLicence: dbRow.requiresLicence,
        requiresInspection: dbRow.ciqInspection,
        isRestricted: dbRow.isRestricted,
        isProhibited: dbRow.isProhibited,
        importPolicy: "",
        inspectionAgency: "",
        supervisoryConditions: dbRow.supervisoryConditions ?? "",
        dataSource: dbRow.dataSource ?? "database",
        lastUpdated: dbRow.lastUpdated?.toISOString() ?? "",
      });
    }
    const row = await getChinaCode(code);
    return res.json(row);
  }

  const dbRow = await db.indiaHsCode.findUnique({ where: { hsCode: code } }).catch(() => null);
  if (dbRow) {
    return res.json({
      country: "IN",
      hsCode: dbRow.hsCode,
      descriptionEn: dbRow.descriptionEn,
      descriptionLocal: dbRow.descriptionHi ?? "",
      chapter: dbRow.chapter,
      dutyRate: dbRow.bcdRate ? Number(dbRow.bcdRate) : null,
      secondaryRate: dbRow.igstRate ? Number(dbRow.igstRate) : null,
      requiresLicence: dbRow.requiresLicence,
      requiresInspection: dbRow.requiresInspection,
      isRestricted: dbRow.isRestricted,
      isProhibited: dbRow.isProhibited,
      importPolicy: dbRow.importPolicy ?? "",
      inspectionAgency: dbRow.inspectionAgency ?? "",
      supervisoryConditions: "",
      dataSource: dbRow.dataSource ?? "database",
      lastUpdated: dbRow.lastUpdated?.toISOString() ?? "",
    });
  }
  const row = await getIndiaCode(code);
  res.json(row);
});

app.get("/api/v1/chapters/:country", async (req, res) => {
  const rows = req.params.country === "CN" ? await localChina() : await localIndia();
  const chapters = [...new Set(rows.map((row: any) => String(row.chapter ?? "").padStart(2, "0")))]
    .filter(Boolean)
    .sort();
  res.json(chapters);
});

app.get("/api/v1/sections/:country", async (req, res) => {
  const rows = req.params.country === "CN" ? await localChina() : await localIndia();
  const sections = [...new Set(rows.map((row: any) => row.section).filter(Boolean))].sort();
  res.json(sections);
});

app.get("/api/v1/match/:code", async (req, res) => {
  const code = req.params.code;

  const cnRow = await db.chinaHsCode.findUnique({ where: { hsCode8: code } }).catch(() => null);
  const inRow = await db.indiaHsCode.findUnique({ where: { hsCode: code } }).catch(() => null);

  const china = cnRow
    ? {
        country: "CN" as const,
        hsCode: cnRow.hsCode8,
        descriptionEn: cnRow.descriptionEn,
        descriptionLocal: cnRow.descriptionZh ?? "",
        dutyRate: cnRow.mfnDutyRate ? Number(cnRow.mfnDutyRate) : null,
        secondaryRate: cnRow.vatRate ? Number(cnRow.vatRate) : null,
        requiresLicence: cnRow.requiresLicence,
        requiresInspection: cnRow.ciqInspection,
        isRestricted: cnRow.isRestricted,
        isProhibited: cnRow.isProhibited,
        importPolicy: "",
        inspectionAgency: "",
        supervisoryConditions: cnRow.supervisoryConditions ?? "",
        dataSource: cnRow.dataSource ?? "database",
        lastUpdated: cnRow.lastUpdated?.toISOString() ?? "",
      }
    : (await getChinaCode(code));

  const india = inRow
    ? {
        country: "IN" as const,
        hsCode: inRow.hsCode,
        descriptionEn: inRow.descriptionEn,
        descriptionLocal: inRow.descriptionHi ?? "",
        dutyRate: inRow.bcdRate ? Number(inRow.bcdRate) : null,
        secondaryRate: inRow.igstRate ? Number(inRow.igstRate) : null,
        requiresLicence: inRow.requiresLicence,
        requiresInspection: inRow.requiresInspection,
        isRestricted: inRow.isRestricted,
        isProhibited: inRow.isProhibited,
        importPolicy: inRow.importPolicy ?? "",
        inspectionAgency: inRow.inspectionAgency ?? "",
        supervisoryConditions: "",
        dataSource: inRow.dataSource ?? "database",
        lastUpdated: inRow.lastUpdated?.toISOString() ?? "",
      }
    : (await getIndiaCode(code));

  if (!china && !india) {
    return res.json([]);
  }

  const confidence = china && india ? 0.95 : china || india ? 0.6 : 0;
  res.json([{ id: 1, matchConfidence: confidence, matchMethod: china && india ? "exact-bilateral" : "single-country", china, india }]);
});

app.post("/api/v1/duty-calculate", async (req, res) => {
  const payload = DutyRequestSchema.parse(req.body);
  try {
    res.json(await calculate(payload.country, payload.hsCode, payload.cifUsd, payload.landingChargesUsd));
  } catch {
    if (payload.country === "IN") {
      const row = await getIndiaCode(payload.hsCode);
      if (!row) throw new Error("No India duty data for this code yet");
      const cif = payload.cifUsd;
      const landing = payload.landingChargesUsd ?? 0;
      const av = cif + landing;
      const bcd = av * (Number(row.dutyRate ?? 0) / 100);
      const sws = bcd * 0.1;
      const base = av + bcd + sws;
      const igst = base * (Number(row.secondaryRate ?? 0) / 100);
      const total = bcd + sws + igst;
      return res.json({
        country: "IN",
        currency: "INR",
        exchangeRate: 1,
        effectiveDate: "local-demo",
        lines: [
          { label: "CIF", amount: cif },
          { label: "Landing charges", amount: landing },
          { label: "Assessable value", amount: av },
          { label: "BCD", amount: bcd },
          { label: "SWS", amount: sws },
          { label: "IGST base", amount: base },
          { label: "IGST", amount: igst },
        ],
        totalDuty: total,
        landedCost: av + total,
      });
    }
    throw new Error("No duty data available");
  }
});

app.post("/api/v1/classify", async (req, res) => {
  try {
    const payload = ClassifyRequestSchema.parse(req.body);
    const ai = await classify(payload.description, payload.country);
    const results = ai ?? (await fallbackClassify(payload.description, payload.country, 5));
    res.json({ fallback: !ai, results });
  } catch (err: any) {
    console.error("Classify error:", err?.message ?? err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.post("/api/v1/log-error", async (req, res) => {
  const payload = ErrorLogSchema.parse(req.body);
  await db.errorLog.create({ data: payload });
  res.status(204).end();
});

app.get("/health", async (_req, res) => {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    // keep degraded state
  }

  res.json({
    status: database ? "ok" : "degraded",
    database,
    supabase: database,
    geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.get("/metrics", async (_req, res) => {
  res.type(registry.contentType).send(await registry.metrics());
});

app.use(async (err: any, req: any, res: any, _next: any) => {
  await db.errorLog
    .create({
      data: { route: req.path, message: String(err.message ?? err), stack: err.stack },
    })
    .catch(() => {});
  res.status(500).json({ error: "Internal server error" });
});

app.listen(Number(process.env.PORT ?? 4000));
