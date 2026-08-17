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
  getChapterList,
} from "@tradecode/shared-types";
import { db } from "./db.js";
import { calculate, rates } from "./services/duty.js";
import { createSearchProvider } from "./services/search/index.js";
import { classify, isModel3x, getModel } from "./services/gemini.js";
import { detectProductCategories } from "./product-categories.js";

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

type LocalUaeRow = {
  hs_code: string;
  chapter: string;
  description_en: string;
  description_ar?: string | null;
  customs_duty_rate?: number | null;
  vat_rate?: number | null;
  excise_rate?: number | null;
  is_restricted?: boolean | null;
  is_prohibited?: boolean | null;
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
const localUaePath = new URL("../../../data/fixtures/local-uae-seed.json", import.meta.url);
const candidatePath = new URL("../../../data/fixtures/unverified-candidates.json", import.meta.url);

let localIndiaCache: LocalIndiaRow[] = [];
let localChinaCache: LocalChinaRow[] = [];
let localUaeCache: LocalUaeRow[] = [];
let candidateCache: CandidateRow[] = [];

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

async function localUae(): Promise<LocalUaeRow[]> {
  localUaeCache ??= await loadJson<LocalUaeRow[]>(localUaePath).catch(() => [] as LocalUaeRow[]);
  if (localUaeCache.length === 0) {
    localUaeCache = await db.$queryRaw<LocalUaeRow[]>`SELECT hs_code, chapter, description_en, description_ar, customs_duty_rate, vat_rate, excise_rate, is_restricted, is_prohibited, data_source, last_updated::text FROM hs_codes_uae`;
  }
  return localUaeCache;
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

function toSearchResultUae(row: LocalUaeRow) {
  return {
    country: "AE" as const,
    hsCode: row.hs_code,
    descriptionEn: row.description_en,
    descriptionLocal: row.description_ar ?? "",
    chapter: row.chapter ?? "",
    dutyRate: row.customs_duty_rate ?? null,
    secondaryRate: row.vat_rate ?? null,
    requiresLicence: false,
    requiresInspection: false,
    isRestricted: row.is_restricted ?? false,
    isProhibited: row.is_prohibited ?? false,
    importPolicy: "",
    inspectionAgency: "",
    supervisoryConditions: row.excise_rate != null ? `Excise: ${row.excise_rate}%` : "",
    dataSource: row.data_source ?? "GCC Common External Tariff",
    lastUpdated: row.last_updated ?? "",
  };
}

async function getUaeCode(code: string) {
  const row = (await localUae()).find((item) => item.hs_code === code);
  return row ? toSearchResultUae(row) : null;
}

async function fallbackSearch(q: string, country: "CN" | "IN" | "AE" | "BOTH", limit: number) {
  const needle = q.toLowerCase();
  const indiaRows = await localIndia();
  const chinaRows = await localChina();
  const uaeRows = await localUae();

  const rows = [
    ...indiaRows.map((row) => toSearchResult(mergeIndiaRates(row), "IN")),
    ...chinaRows.map((row) => toSearchResult(mergeChinaRates(row), "CN")),
    ...uaeRows.map((row) => toSearchResultUae(row)),
  ]
    .filter((row) => country === "BOTH" || row.country === country);

  if (!needle) return rows.slice(0, limit);

  const scored = rows
    .map((row) => ({
      ...row,
      score: scoreMatch(q, `${row.hsCode} ${row.descriptionEn} ${row.descriptionLocal ?? ""}`),
    }))
    .filter((row) => row.score > 0.05)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  return scored.filter((row) => {
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

/* ── Scoring with chapter intelligence ─────────────────────────── */

function chapterMultiplier(queryChapters: string[], codeChapter: string): number {
  if (queryChapters.length === 0) return 1.0;
  if (queryChapters.includes(codeChapter)) return 1.5;
  return 0.15;
}

function scoreMatch(
  query: string,
  candidate: string,
  codeChapter?: string,
  queryChapters?: string[],
): number {
  const qLower = query.toLowerCase().trim();

  // Tier 0: HS code match (query is all digits, 4-10 chars)
  if (/^\d{4,10}$/.test(qLower)) {
    // candidate = "hsCode description..."
    const codePart = candidate.split(/\s/)[0]?.toLowerCase() ?? "";
    if (codePart === qLower) return 1.0;
    if (codePart.startsWith(qLower)) return 0.95;
    if (codePart.substring(0, 4) === qLower.substring(0, 4)) return 0.70;
    // Still allow description fallback for code queries
  }

  const qTokens = tokenize(query);
  const cTokens = tokenize(candidate);
  if (!qTokens.length || !cTokens.length) return 0;

  const cLower = candidate.toLowerCase();
  const candidateSet = new Set(cTokens);

  const chapterBoost = (queryChapters && codeChapter)
    ? chapterMultiplier(queryChapters, codeChapter)
    : 1.0;

  // Exact phrase match
  if (cLower.includes(qLower)) {
    let lastIdx = -1;
    let inOrder = true;
    for (const w of qTokens) {
      const idx = cLower.indexOf(w, lastIdx + 1);
      if (idx === -1) { inOrder = false; break; }
      lastIdx = idx;
    }
    return Math.min(1.0, (inOrder ? 1.0 : 0.95) * chapterBoost);
  }

  const exactOverlap = qTokens.filter((t) => candidateSet.has(t)).length;
  const exactCoverage = exactOverlap / qTokens.length;

  const partialOverlap = qTokens.filter((t) =>
    cTokens.some((ct) => ct.includes(t) || t.includes(ct))
  ).length;
  const partialCoverage = partialOverlap / qTokens.length;

  let orderBonus = 0;
  {
    let lastIdx = -1;
    let inOrderCount = 0;
    for (const w of qTokens) {
      const idx = cLower.indexOf(w, lastIdx + 1);
      if (idx !== -1) { inOrderCount++; lastIdx = idx; }
    }
    orderBonus = (inOrderCount / qTokens.length) * 0.1;
  }

  let rawScore = 0;
  if (exactCoverage === 1) {
    rawScore = Math.min(0.95, 0.80 + exactCoverage * 0.15 + orderBonus);
  } else if (partialCoverage === 1) {
    rawScore = Math.min(0.85, 0.65 + partialCoverage * 0.2 + orderBonus);
  } else if (exactCoverage >= 0.6 || partialCoverage >= 0.6) {
    const best = Math.max(exactCoverage, partialCoverage);
    rawScore = Math.min(0.75, 0.40 + best * 0.35 + orderBonus);
  } else if (exactCoverage >= 0.3 || partialCoverage >= 0.3) {
    const best = Math.max(exactCoverage, partialCoverage);
    rawScore = Math.min(0.55, 0.15 + best * 0.4 + orderBonus);
  } else if (exactCoverage > 0 || partialCoverage > 0) {
    const best = Math.max(exactCoverage, partialCoverage);
    rawScore = Math.min(0.30, 0.05 + best * 0.25);
  }

  return Math.min(1.0, rawScore * chapterBoost);
}

function confidencePercent(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score * 100)));
}

function enrichChineseDescriptions<T extends { country: string; hsCode: string; descriptionLocal?: string | null }>(
  results: T[],
  chinaCache: { hs_code_8: string; hs_code?: string | null; description_zh?: string | null }[],
): T[] {
  const cnMap = new Map<string, string>();
  for (const c of chinaCache) {
    const key = c.hs_code_8 || c.hs_code;
    if (key && c.description_zh) cnMap.set(key, c.description_zh);
  }
  return results.map((r) => {
    if (r.country === "CN" || !r.descriptionLocal) return r;
    const zh = cnMap.get(r.hsCode);
    if (zh) return { ...r, descriptionLocal: zh };
    return r;
  });
}

async function fallbackClassify(description: string, country: "CN" | "IN" | "AE" | "BOTH", limit: number) {
  const normalized = description.trim();
  const hasMeaningfulToken = tokenize(normalized).length >= 2;
  if (!hasMeaningfulToken) return [];

  const targetChapters = detectProductCategories(normalized);

  const indiaRows = await localIndia();
  const chinaRows = await localChina();
  const uaeRows = await localUae();

  const allRows = [
    ...indiaRows.map((row) => ({ ...toSearchResult(mergeIndiaRates(row), "IN"), chapter: String(row.chapter ?? "").padStart(2, "0") })),
    ...chinaRows.map((row) => ({ ...toSearchResult(mergeChinaRates(row), "CN"), chapter: String(row.chapter ?? "").padStart(2, "0") })),
    ...uaeRows.map((row) => ({ ...toSearchResultUae(row), chapter: String(row.chapter ?? "").padStart(2, "0") })),
  ].filter((row) => country === "BOTH" || row.country === country);

  const scored = allRows
    .map((row) => ({
      ...row,
      score: scoreMatch(normalized, `${row.hsCode} ${row.descriptionEn} ${row.descriptionLocal ?? ""}`, row.chapter, targetChapters),
    }))
    .filter((row) => row.score >= 0.05)
    .sort((a, b) => b.score - a.score || Number((b.dutyRate ?? 0) + (b.secondaryRate ?? 0)) - Number((a.dutyRate ?? 0) + (a.secondaryRate ?? 0)));

  if (!scored.length) return [];

  if (country === "BOTH") {
    const perCountry = Math.max(3, Math.ceil(limit / 3));
    const cnTop = scored.filter(r => r.country === "CN").slice(0, perCountry);
    const inTop = scored.filter(r => r.country === "IN").slice(0, perCountry);
    const aeTop = scored.filter(r => r.country === "AE").slice(0, perCountry);
    return [...cnTop, ...inTop, ...aeTop]
      .map(({ score, chapter, ...row }) => ({ ...row, confidence: confidencePercent(score) }));
  }

  return scored.slice(0, limit).map(({ score, chapter, ...row }) => ({ ...row, confidence: confidencePercent(score) }));
}

app.get("/api/v1/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  const country = CountrySchema.parse(req.query.country ?? "BOTH");

  try {
    const results = await search.search(q, country, 20);
    const enriched = enrichChineseDescriptions(results, await localChina());
    db.searchLog.create({ data: { query: q, country, resultCount: enriched.length } }).catch(() => {});
    res.json({ results: enriched, total: enriched.length });
  } catch {
    const results = await fallbackSearch(q, country, 20);
    const enriched = enrichChineseDescriptions(results, await localChina());
    res.json({ results: enriched, total: enriched.length });
  }
});

app.get("/api/v1/autocomplete", async (req, res) => {
  try {
    const results = await search.search(String(req.query.q ?? ""), CountrySchema.parse(req.query.country ?? "BOTH"), 5);
    res.json({ results: enrichChineseDescriptions(results, await localChina()) });
  } catch {
    const results = await fallbackSearch(String(req.query.q ?? ""), CountrySchema.parse(req.query.country ?? "BOTH"), 5);
    res.json({ results: enrichChineseDescriptions(results, await localChina()) });
  }
});

app.get("/api/v1/code/:country/:code", async (req, res) => {
  const country = req.params.country === "CN" ? "CN" : req.params.country === "AE" ? "AE" : "IN";
  const code = req.params.code;

  if (country === "AE") {
    const dbRow = await db.uaeHsCode.findUnique({ where: { hsCode: code } }).catch(() => null);
    if (dbRow) {
      const cnRow = (await localChina()).find(c => c.hs_code_8 === code || c.hs_code === code);
      return res.json({
        country: "AE",
        hsCode: dbRow.hsCode,
        descriptionEn: dbRow.descriptionEn,
        descriptionLocal: cnRow?.description_zh ?? dbRow.descriptionAr ?? "",
        chapter: dbRow.chapter,
        dutyRate: Number(dbRow.customsDutyRate),
        secondaryRate: Number(dbRow.vatRate),
        requiresLicence: false,
        requiresInspection: false,
        isRestricted: dbRow.isRestricted,
        isProhibited: dbRow.isProhibited,
        importPolicy: "",
        inspectionAgency: "",
        supervisoryConditions: dbRow.exciseRate != null ? `Excise: ${dbRow.exciseRate}%` : "",
        dataSource: dbRow.dataSource ?? "database",
        lastUpdated: dbRow.lastUpdated?.toISOString() ?? "",
      });
    }
    const row = await getUaeCode(code);
    if (row) {
      const cnRow = (await localChina()).find(c => c.hs_code_8 === code || c.hs_code === code);
      if (cnRow?.description_zh) row.descriptionLocal = cnRow.description_zh;
    }
    return res.json(row);
  }

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
    const cnRow = (await localChina()).find(c => c.hs_code_8 === code || c.hs_code === code);
    return res.json({
      country: "IN",
      hsCode: dbRow.hsCode,
      descriptionEn: dbRow.descriptionEn,
      descriptionLocal: cnRow?.description_zh ?? dbRow.descriptionHi ?? "",
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
  if (row) {
    const cnRow = (await localChina()).find(c => c.hs_code_8 === code || c.hs_code === code);
    if (cnRow?.description_zh) row.descriptionLocal = cnRow.description_zh;
  }
  res.json(row);
});

app.get("/api/v1/chapters/:country", async (req, res) => {
  const countryParam = req.params.country;
  let rows: any[];
  if (countryParam === "AE") {
    rows = await localUae();
  } else if (countryParam === "CN") {
    rows = await localChina();
  } else {
    rows = await localIndia();
  }
  const chapters = [...new Set(rows.map((row: any) => String(row.chapter ?? "").padStart(2, "0")))]
    .filter(Boolean)
    .sort();
  res.json(chapters);
});

app.get("/api/v1/browse/:country", async (req, res) => {
  try {
    const countryParam = req.params.country;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit as string) || 100));
    const chapter = (req.query.chapter as string) || "";
    const q = ((req.query.q as string) || "").trim().toLowerCase();
    const sort = (req.query.sort as string) || "hsCode";
    const order = (req.query.order as string) === "desc" ? "desc" : "asc";

    let rows: any[];
    let mapRow: (row: any) => any;

    if (countryParam === "AE") {
      rows = await localUae();
      mapRow = (r: any) => ({
        country: "AE",
        hsCode: r.hs_code,
        descriptionEn: r.description_en ?? "",
        descriptionLocal: r.description_ar ?? "",
        chapter: String(r.chapter ?? "").padStart(2, "0"),
        dutyRate: r.customs_duty_rate ?? null,
        secondaryRate: r.vat_rate ?? null,
        requiresLicence: false,
        requiresInspection: false,
        isRestricted: r.is_restricted ?? false,
        isProhibited: r.is_prohibited ?? false,
        importPolicy: null,
        inspectionAgency: null,
        supervisoryConditions: r.excise_rate > 0 ? `Excise: ${r.excise_rate}%` : null,
        dataSource: r.data_source ?? null,
        lastUpdated: r.last_updated ?? null,
      });
    } else if (countryParam === "CN") {
      rows = await localChina();
      mapRow = (r: any) => ({
        country: "CN",
        hsCode: r.hs_code_8 ?? r.hs_code,
        descriptionEn: r.description_en ?? "",
        descriptionLocal: r.description_zh ?? "",
        chapter: String(r.chapter ?? "").padStart(2, "0"),
        dutyRate: r.mfn_duty_rate ?? null,
        secondaryRate: r.vat_rate ?? null,
        requiresLicence: r.requires_licence ?? false,
        requiresInspection: r.ciq_inspection ?? false,
        isRestricted: r.is_restricted ?? false,
        isProhibited: r.is_prohibited ?? false,
        importPolicy: null,
        inspectionAgency: null,
        supervisoryConditions: r.supervisory_conditions ?? null,
        dataSource: r.data_source ?? null,
        lastUpdated: r.last_updated ?? null,
      });
    } else {
      rows = await localIndia();
      mapRow = (r: any) => ({
        country: "IN",
        hsCode: r.hs_code,
        descriptionEn: r.description_en ?? "",
        descriptionLocal: r.description_hi ?? "",
        chapter: String(r.chapter ?? "").padStart(2, "0"),
        dutyRate: r.bcd_rate ?? null,
        secondaryRate: r.igst_rate ?? null,
        requiresLicence: r.requires_licence ?? false,
        requiresInspection: r.requires_inspection ?? false,
        isRestricted: r.is_restricted ?? false,
        isProhibited: r.is_prohibited ?? false,
        importPolicy: r.import_policy ?? null,
        inspectionAgency: r.inspection_agency ?? null,
        supervisoryConditions: null,
        dataSource: r.data_source ?? null,
        lastUpdated: r.last_updated ?? null,
      });
    }

    const allChapters = [...new Set(rows.map((r: any) => String(r.chapter ?? "").padStart(2, "0")))].filter(Boolean).sort();
    const chaptersWithNames = getChapterList(allChapters);

    let mapped = rows.map(mapRow);

    if (chapter) {
      mapped = mapped.filter((r) => r.chapter === chapter);
    }

    if (q) {
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      if (words.length > 0) {
        // Score each row by word-level matching for proper relevance
        const scored = mapped.map((r) => {
          const desc = String(r.descriptionEn).toLowerCase();
          const local = String(r.descriptionLocal || "").toLowerCase();
          const hs = String(r.hsCode).toLowerCase();
          const combined = `${desc} ${local}`;

          // Exact phrase match → highest score
          if (desc.includes(q.toLowerCase()) || combined.includes(q.toLowerCase())) {
            return { row: r, score: 1.0 };
          }

          // All words present → high score
          const matchedWords = words.filter((w) => combined.includes(w) || hs.includes(w));
          const coverage = matchedWords.length / words.length;

          if (coverage === 1) {
            return { row: r, score: 0.7 + 0.25 * coverage };
          }
          if (coverage >= 0.5) {
            return { row: r, score: 0.4 + 0.3 * coverage };
          }
          if (coverage > 0) {
            return { row: r, score: 0.1 + 0.2 * coverage };
          }
          return { row: r, score: 0 };
        });

        mapped = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.row);
      } else {
        // Single character query — simple substring match
        mapped = mapped.filter((r) =>
          String(r.hsCode).includes(q.toLowerCase()) ||
          String(r.descriptionEn).toLowerCase().includes(q.toLowerCase()) ||
          String(r.descriptionLocal || "").toLowerCase().includes(q.toLowerCase())
        );
      }
    }

    const total = mapped.length;

    const sortFn = (a: any, b: any) => {
      let va: any, vb: any;
      if (sort === "dutyRate") {
        va = a.dutyRate ?? -1;
        vb = b.dutyRate ?? -1;
      } else if (sort === "description") {
        va = a.descriptionEn ?? "";
        vb = b.descriptionEn ?? "";
      } else {
        va = a.hsCode ?? "";
        vb = b.hsCode ?? "";
      }
      if (typeof va === "string") return order === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return order === "asc" ? va - vb : vb - va;
    };

    mapped.sort(sortFn);

    const start = (page - 1) * limit;
    let results = mapped.slice(start, start + limit);

    if (countryParam !== "CN") {
      results = enrichChineseDescriptions(results, await localChina());
    }

    res.json({ results, total, page, limit, chapters: chaptersWithNames });
  } catch (err: any) {
    console.error("browse error:", err);
    res.status(500).json({ error: err?.message ?? "Browse failed" });
  }
});

app.get("/api/v1/sections/:country", async (req, res) => {
  const countryParam = req.params.country;
  let rows: any[];
  if (countryParam === "AE") {
    rows = await localUae();
  } else if (countryParam === "CN") {
    rows = await localChina();
  } else {
    rows = await localIndia();
  }
  const sections = [...new Set(rows.map((row: any) => row.section).filter(Boolean))].sort();
  res.json(sections);
});

async function findClosestMatch(
  sourceCode: string,
  sourceDesc: string,
  sourceChapter: string,
  targetCountry: "CN" | "IN" | "AE",
): Promise<{
  hsCode: string;
  descriptionEn: string;
  descriptionLocal?: string;
  chapter: string;
  dutyRate: number | null;
  secondaryRate: number | null;
  confidence: number;
  matchMethod: string;
  similarityScore: number;
} | null> {
  // ── Jaccard token similarity on descriptions ─────────────────
  function descSimilarity(a: string, b: string): number {
    const stopwords = new Set([
      "and","or","of","the","for","in","to","a","an","other",
      "not","with","including","than","more","used","similar",
      "products","goods","articles","specified","like","such",
      "whether","being","those","their","which","from","its",
      "has","are","is","as","by","at","on","into","out","all",
      "this","that","these","where","when","only","also","both",
    ]);
    const tok = (s: string) =>
      s.toLowerCase()
       .replace(/[^a-z0-9\s]/g, " ")
       .split(/\s+/)
       .filter(t => t.length > 2 && !stopwords.has(t));
    const ta = new Set(tok(a));
    const tb = new Set(tok(b));
    if (!ta.size || !tb.size) return 0;
    let overlap = 0;
    for (const t of ta) if (tb.has(t)) overlap++;
    const union = new Set([...ta, ...tb]).size;
    return overlap / union;
  }

  // Confidence is driven primarily by description similarity.
  // The step only sets the ceiling and a small starting bonus.
  function calcConfidence(sim: number, step: "6digit" | "4digit" | "chapter"): number {
    const ceiling = step === "6digit" ? 90 : step === "4digit" ? 65 : 40;
    const bonus = step === "6digit" ? 10 : step === "4digit" ? 5 : 0;
    return Math.min(ceiling, Math.round(sim * (ceiling - bonus)) + bonus);
  }

  // Check cached CN↔IN mappings first, but still compare against
  // 4-digit cross-heading candidates (same logic as uncached path).
  if (targetCountry === "CN") {
    const existing = await db.bilateralMapping.findFirst({
      where: { indiaHsCode: sourceCode },
      include: { china: true },
    });
    if (existing) {
      const step = existing.matchMethod.includes("4digit")
        ? "4digit"
        : existing.matchMethod.includes("chapter")
          ? "chapter"
          : "6digit";
      const cachedSim = descSimilarity(sourceDesc, existing.china.descriptionEn);
      const cachedCandidate = {
        hsCode: existing.china.hsCode8,
        descriptionEn: existing.china.descriptionEn,
        descriptionLocal: existing.china.descriptionZh ?? "",
        chapter: existing.china.chapter,
        dutyRate: existing.china.mfnDutyRate ? Number(existing.china.mfnDutyRate) : null,
        secondaryRate: existing.china.vatRate ? Number(existing.china.vatRate) : null,
      };

      // Also check 4-digit cross-heading candidates
      const prefix4 = sourceCode.substring(0, 4);
      const fourCandidates = await db.chinaHsCode.findMany({
        where: { hsCode8: { startsWith: prefix4 } },
        take: 200,
      });
      let bestFourSim = 0;
      let bestFourCandidate: typeof cachedCandidate | null = null;
      for (const r of fourCandidates) {
        const sim = descSimilarity(sourceDesc, r.descriptionEn);
        if (sim > bestFourSim) {
          bestFourSim = sim;
          bestFourCandidate = {
            hsCode: r.hsCode8,
            descriptionEn: r.descriptionEn,
            descriptionLocal: r.descriptionZh ?? "",
            chapter: r.chapter,
            dutyRate: r.mfnDutyRate ? Number(r.mfnDutyRate) : null,
            secondaryRate: r.vatRate ? Number(r.vatRate) : null,
          };
        }
      }

      // If 4-digit scores >0.15 higher, prefer cross-heading match
      if (bestFourCandidate && bestFourSim > cachedSim + 0.15) {
        return {
          ...bestFourCandidate,
          confidence: calcConfidence(bestFourSim, "4digit"),
          matchMethod: "4digit_description_scored_cross_heading_cached",
          similarityScore: bestFourSim,
        };
      }

      return {
        ...cachedCandidate,
        confidence: calcConfidence(cachedSim, step),
        matchMethod: existing.matchMethod.replace(/(?:_cached)+$/, "") + "_cached",
        similarityScore: cachedSim,
      };
    }
  }
  if (targetCountry === "IN") {
    const existing = await db.bilateralMapping.findFirst({
      where: { chinaHsCode8: sourceCode },
      include: { india: true },
    });
    if (existing) {
      const step = existing.matchMethod.includes("4digit")
        ? "4digit"
        : existing.matchMethod.includes("chapter")
          ? "chapter"
          : "6digit";
      const cachedSim = descSimilarity(sourceDesc, existing.india.descriptionEn);
      const cachedCandidate = {
        hsCode: existing.india.hsCode,
        descriptionEn: existing.india.descriptionEn,
        descriptionLocal: existing.india.descriptionHi ?? "",
        chapter: existing.india.chapter,
        dutyRate: existing.india.bcdRate ? Number(existing.india.bcdRate) : null,
        secondaryRate: existing.india.igstRate ? Number(existing.india.igstRate) : null,
      };

      // Also check 4-digit cross-heading candidates
      const prefix4 = sourceCode.substring(0, 4);
      const fourCandidates = await db.indiaHsCode.findMany({
        where: { hsCode: { startsWith: prefix4 } },
        take: 200,
      });
      let bestFourSim = 0;
      let bestFourCandidate: typeof cachedCandidate | null = null;
      for (const r of fourCandidates) {
        const sim = descSimilarity(sourceDesc, r.descriptionEn);
        if (sim > bestFourSim) {
          bestFourSim = sim;
          bestFourCandidate = {
            hsCode: r.hsCode,
            descriptionEn: r.descriptionEn,
            descriptionLocal: r.descriptionHi ?? "",
            chapter: r.chapter,
            dutyRate: r.bcdRate ? Number(r.bcdRate) : null,
            secondaryRate: r.igstRate ? Number(r.igstRate) : null,
          };
        }
      }

      if (bestFourCandidate && bestFourSim > cachedSim + 0.15) {
        return {
          ...bestFourCandidate,
          confidence: calcConfidence(bestFourSim, "4digit"),
          matchMethod: "4digit_description_scored_cross_heading_cached",
          similarityScore: bestFourSim,
        };
      }

      return {
        ...cachedCandidate,
        confidence: calcConfidence(cachedSim, step),
        matchMethod: existing.matchMethod.replace(/(?:_cached)+$/, "") + "_cached",
        similarityScore: cachedSim,
      };
    }
  }

  type Candidate = {
    hsCode: string;
    descriptionEn: string;
    descriptionLocal: string;
    chapter: string;
    dutyRate: number | null;
    secondaryRate: number | null;
  };

  async function fetchMany(where: any, take: number): Promise<Candidate[]> {
    if (targetCountry === "CN") {
      const rows = await db.chinaHsCode.findMany({ where, take });
      return rows.map(r => ({
        hsCode: r.hsCode8,
        descriptionEn: r.descriptionEn,
        descriptionLocal: r.descriptionZh ?? "",
        chapter: r.chapter,
        dutyRate: r.mfnDutyRate ? Number(r.mfnDutyRate) : null,
        secondaryRate: r.vatRate ? Number(r.vatRate) : null,
      }));
    } else if (targetCountry === "IN") {
      const rows = await db.indiaHsCode.findMany({ where, take });
      return rows.map(r => ({
        hsCode: r.hsCode,
        descriptionEn: r.descriptionEn,
        descriptionLocal: r.descriptionHi ?? "",
        chapter: r.chapter,
        dutyRate: r.bcdRate ? Number(r.bcdRate) : null,
        secondaryRate: r.igstRate ? Number(r.igstRate) : null,
      }));
    } else {
      const rows = await db.uaeHsCode.findMany({ where, take });
      return rows.map(r => ({
        hsCode: r.hsCode,
        descriptionEn: r.descriptionEn,
        descriptionLocal: r.descriptionAr ?? "",
        chapter: r.chapter,
        dutyRate: Number(r.customsDutyRate),
        secondaryRate: Number(r.vatRate),
      }));
    }
  }

  function scoreAndRank(candidates: Candidate[], sourceDescription: string) {
    return candidates
      .map(c => ({
        ...c,
        sim: descSimilarity(sourceDescription, c.descriptionEn),
      }))
      .filter(c => c.sim > 0)
      .sort((a, b) => b.sim - a.sim);
  }

  const codeField = targetCountry === "CN" ? "hsCode8" : "hsCode";

  // ── STEP 1: 6-digit WCO heading match, scored by description ─
  // The first 6 digits are internationally standardised —
  // all countries using HS share the same 6-digit headings.
  // This is the only valid numerical anchor for matching.
  // However, we also check 4-digit neighbours because sometimes
  // a semantically better match exists in an adjacent heading
  // (e.g. 84813099 check valves matches 84818090 other taps,
  // not 84813000 check valves in a different product family).
  const prefix6 = sourceCode.substring(0, 6);
  const sixCandidates = await fetchMany(
    { [codeField]: { startsWith: prefix6 } },
    50
  );
  let bestSix: { sim: number; rest: Omit<Candidate, "sim">; confidence: number } | null = null;
  if (sixCandidates.length > 0) {
    const ranked = scoreAndRank(sixCandidates, sourceDesc);
    if (ranked.length > 0 && ranked[0].sim > 0) {
      const best = ranked[0];
      const confidence = calcConfidence(best.sim, "6digit");
      const { sim, ...rest } = best;
      bestSix = { sim, rest, confidence };
    }
  }

  // ── STEP 1b: Also check 4-digit neighbours ──────────────────
  const prefix4 = sourceCode.substring(0, 4);
  const fourCandidatesForCompare = await fetchMany(
    { [codeField]: { startsWith: prefix4 } },
    200
  );
  let bestFour: { sim: number; rest: Omit<Candidate, "sim">; confidence: number } | null = null;
  if (fourCandidatesForCompare.length > 0) {
    const ranked = scoreAndRank(fourCandidatesForCompare, sourceDesc);
    if (ranked.length > 0 && ranked[0].sim > 0) {
      const best = ranked[0];
      const confidence = calcConfidence(best.sim, "4digit");
      const { sim, ...rest } = best;
      bestFour = { sim, rest, confidence };
    }
  }

  // Compare: if 4-digit scores > 0.15 higher on description similarity,
  // prefer it over the 6-digit match (cross-heading semantic win).
  if (bestSix && bestFour && bestFour.sim > bestSix.sim + 0.15) {
    return {
      ...bestFour.rest,
      confidence: bestFour.confidence,
      matchMethod: "4digit_description_scored_cross_heading",
      similarityScore: bestFour.sim,
    };
  }
  if (bestSix) {
    return {
      ...bestSix.rest,
      confidence: bestSix.confidence,
      matchMethod: "6digit_description_scored",
      similarityScore: bestSix.sim,
    };
  }

  // ── STEP 2: 4-digit heading match, scored by description ─────
  // The 4-digit heading is still a meaningful grouping
  // (same product family) but accuracy is lower.
  // MUST use description scoring — never return by position.
  if (bestFour && bestFour.sim >= 0.08) {
    return {
      ...bestFour.rest,
      confidence: bestFour.confidence,
      matchMethod: "4digit_description_scored",
      similarityScore: bestFour.sim,
    };
  }

  // ── STEP 3: Full chapter match, scored by description ────────
  // Last resort. Same chapter means same broad product category.
  // Description scoring is essential here — chapters can have
  // hundreds of codes covering very different specific products.
  const chapterCandidates = await fetchMany(
    { chapter: sourceChapter },
    500
  );
  if (!chapterCandidates.length) return null;

  const ranked = scoreAndRank(chapterCandidates, sourceDesc);
  if (!ranked.length || ranked[0].sim < 0.08) return null;

  const best = ranked[0];
  const confidence = calcConfidence(best.sim, "chapter");
  const { sim, ...rest } = best;
  return {
    ...rest,
    confidence,
    matchMethod: "chapter_description_scored",
    similarityScore: sim,
  };
}

app.get("/api/v1/match/:code", async (req, res) => {
  const code = req.params.code;
  const fromCountry = (req.query.from as string ?? "").toUpperCase();

  const lookUpExact = (c: "CN" | "IN" | "AE") =>
    !fromCountry || fromCountry === "BOTH" || fromCountry === c;

  const cnRow = lookUpExact("CN")
    ? await db.chinaHsCode.findUnique({ where: { hsCode8: code } }).catch(() => null)
    : null;
  const inRow = lookUpExact("IN")
    ? await db.indiaHsCode.findUnique({ where: { hsCode: code } }).catch(() => null)
    : null;
  const aeRow = lookUpExact("AE")
    ? await db.uaeHsCode.findUnique({ where: { hsCode: code } }).catch(() => null)
    : null;

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
    : (lookUpExact("CN") ? await getChinaCode(code) : null);

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
    : (lookUpExact("IN") ? await getIndiaCode(code) : null);

  const uae = aeRow
    ? {
        country: "AE" as const,
        hsCode: aeRow.hsCode,
        descriptionEn: aeRow.descriptionEn,
        descriptionLocal: aeRow.descriptionAr ?? "",
        dutyRate: Number(aeRow.customsDutyRate),
        secondaryRate: Number(aeRow.vatRate),
        requiresLicence: false,
        requiresInspection: false,
        isRestricted: aeRow.isRestricted,
        isProhibited: aeRow.isProhibited,
        importPolicy: "",
        inspectionAgency: "",
        supervisoryConditions: aeRow.exciseRate != null ? `Excise: ${aeRow.exciseRate}%` : "",
        dataSource: aeRow.dataSource ?? "database",
        lastUpdated: aeRow.lastUpdated?.toISOString() ?? "",
      }
    : (lookUpExact("AE") ? await getUaeCode(code) : null);

  if (!china && !india && !uae) {
    return res.json([]);
  }

  const confidence = china && india ? 0.95 : china || india || uae ? 0.6 : 0;

  const sourceDesc = (china?.descriptionEn ?? india?.descriptionEn ?? uae?.descriptionEn ?? "").trim();
  const sourceChapter = code.substring(0, 2);

  const needsClosest = (c: "CN" | "IN" | "AE"): boolean => {
    if (!fromCountry || fromCountry === "BOTH") {
      return c === "CN" ? !china : c === "IN" ? !india : !uae;
    }
    return fromCountry !== c;
  };

  let closestChina = null;
  let closestIndia = null;
  let closestUae = null;

  if (needsClosest("CN") && sourceDesc && sourceChapter) {
    closestChina = await findClosestMatch(code, sourceDesc, sourceChapter, "CN");
  }
  if (needsClosest("IN") && sourceDesc && sourceChapter) {
    closestIndia = await findClosestMatch(code, sourceDesc, sourceChapter, "IN");
  }
  if (needsClosest("AE") && sourceDesc && sourceChapter) {
    closestUae = await findClosestMatch(code, sourceDesc, sourceChapter, "AE");
  }

  const saveMapping = async (targetCountry: "CN" | "IN", result: any, sourceCode: string) => {
    try {
      if (targetCountry === "CN" && result) {
        await db.bilateralMapping.upsert({
          where: { chinaHsCode8_indiaHsCode: {
            chinaHsCode8: result.hsCode,
            indiaHsCode: sourceCode,
          }},
          create: {
            chinaHsCode8: result.hsCode,
            indiaHsCode: sourceCode,
            matchConfidence: result.confidence / 100,
            matchMethod: result.matchMethod.replace(/(?:_cached)+$/, ""),
          },
          update: {
            matchConfidence: result.confidence / 100,
            matchMethod: result.matchMethod.replace(/(?:_cached)+$/, ""),
          },
        });
      }
      if (targetCountry === "IN" && result) {
        await db.bilateralMapping.upsert({
          where: { chinaHsCode8_indiaHsCode: {
            chinaHsCode8: sourceCode,
            indiaHsCode: result.hsCode,
          }},
          create: {
            chinaHsCode8: sourceCode,
            indiaHsCode: result.hsCode,
            matchConfidence: result.confidence / 100,
            matchMethod: result.matchMethod.replace(/(?:_cached)+$/, ""),
          },
          update: {
            matchConfidence: result.confidence / 100,
            matchMethod: result.matchMethod.replace(/(?:_cached)+$/, ""),
          },
        });
      }
    } catch {
      // do not let a mapping save failure break the response
    }
  };

  await saveMapping("CN", closestChina, code);
  await saveMapping("IN", closestIndia, code);

  const confidenceLabel = (c: number): string => {
    if (c >= 80) return "Strong match";
    if (c >= 60) return "Good match";
    if (c >= 40) return "Approximate — verify recommended";
    return "Weak match — manual verification required";
  };

  const withLabel = (m: any) => (m ? { ...m, confidenceLabel: confidenceLabel(m.confidence) } : null);

  const sameCodeBothCountries =
    !!closestChina &&
    !!closestUae &&
    closestChina.hsCode === closestUae.hsCode &&
    closestChina.descriptionEn.trim() === closestUae.descriptionEn.trim();

  res.json([{
    id: 1,
    matchConfidence: confidence,
    matchMethod: china && india ? "exact-bilateral" : "single-country",
    sameCodeBothCountries,
    china,
    india,
    uae,
    closestChina: withLabel(closestChina),
    closestIndia: withLabel(closestIndia),
    closestUae: withLabel(closestUae),
  }]);
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
    if (payload.country === "AE") {
      const row = await getUaeCode(payload.hsCode);
      if (!row) throw new Error("No UAE duty data for this code yet");
      const cif = payload.cifUsd;
      const customDuty = cif * (Number(row.dutyRate ?? 5) / 100);
      const vat = (cif + customDuty) * (Number(row.secondaryRate ?? 5) / 100);
      const total = customDuty + vat;
      const fx = await rates();
      const aed = fx.AED ?? { rate: 1, date: "unknown" };
      return res.json({
        country: "AE",
        currency: "AED",
        exchangeRate: aed.rate,
        effectiveDate: aed.date,
        lines: [
          { label: "CIF", amount: cif },
          { label: "Customs Duty", amount: customDuty },
          { label: "VAT base", amount: cif + customDuty },
          { label: "VAT", amount: vat },
        ],
        totalDuty: total,
        landedCost: cif + total,
      });
    }
    throw new Error("No duty data available");
  }
});

app.post("/api/v1/classify", async (req, res) => {
  try {
    const payload = ClassifyRequestSchema.parse(req.body);
    const ai = await classify(payload.description, payload.country);
    let results: any[] = ai ?? (await fallbackClassify(payload.description, payload.country, 15));

    if (ai) {
      const enriched: any[] = [];
      for (const r of ai) {
        const dbRow =
          r.country === "CN" ? await getChinaCode(r.hsCode) :
          r.country === "IN" ? await getIndiaCode(r.hsCode) :
          await getUaeCode(r.hsCode);
        enriched.push(dbRow
          ? { ...r, ...dbRow, descriptionEn: r.descriptionEn || dbRow.descriptionEn || "" }
          : r);
      }
      results = enriched;
    }

    res.json({ fallback: !ai, results });
  } catch (err: any) {
    console.error("Classify error:", err?.message ?? err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.post("/api/v1/estimate-rate", async (req, res) => {
  try {
    const { country, hsCode } = req.body as { country: string; hsCode: string };
    if (!process.env.GEMINI_API_KEY) return res.json({ rate: null, confidence: "low", note: "No Gemini API key" });

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = await getModel(ai);

    const isChina = country === "CN";
    const prompt = isChina
      ? `What is the current MFN (Most Favoured Nation) import duty rate and VAT rate for China HS code ${hsCode}? Reply with ONLY a JSON object: {"mfn_duty_rate": <number or null>, "vat_rate": <number or null>, "confidence": "high"|"medium"|"low", "note": "<brief reason>"}. Use the current Chinese customs tariff schedule.`
      : `What is the current Basic Customs Duty (BCD) rate and IGST rate for India HS code ${hsCode}? Reply with ONLY a JSON object: {"bcd_rate": <number or null>, "igst_rate": <number or null>, "confidence": "high"|"medium"|"low", "note": "<brief reason>"}. Use the current 2025-26 Indian tariff schedule.`;

    const config: Record<string, unknown> = isModel3x(model) ? { responseMimeType: "application/json" } : { responseMimeType: "application/json", temperature: 0.1 };
    const response = await ai.models.generateContent({ model, contents: prompt, config });
    const parsed = JSON.parse(response.text ?? "{}");
    const rate = isChina ? (parsed.mfn_duty_rate ?? null) : (parsed.bcd_rate ?? null);
    res.json({ rate, confidence: parsed.confidence ?? "low", note: parsed.note ?? "" });
  } catch (err: any) {
    console.error("estimate-rate error:", err?.message ?? err);
    if (err?.stack) console.error("estimate-rate stack:", err.stack);
    res.json({ rate: null, confidence: "low", note: `Estimation failed: ${err?.message ?? "unknown error"}` });
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
