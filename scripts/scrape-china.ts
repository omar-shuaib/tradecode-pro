import { chromium } from "playwright";
import { appendCsv, logInvalid, retry, sleep, validCode, validRate } from "./scraper-utils.js";

const START_URL = "https://wmsw.mofcom.gov.cn/wmsw/sfcxSearch";

type ScrapedRow = {
  hs_code_8: string;
  description_en: string;
  description_zh: string;
  mfn_duty_rate: string;
  vat_rate: string;
  requires_licence: boolean;
  ciq_inspection: boolean;
  supervisory_conditions: string;
};

async function extractRows(page: import("playwright").Page, chapter: string): Promise<string[][]> {
  const selectors = [
    "table tbody tr",
    ".table tbody tr",
    "tr",
  ];

  for (const selector of selectors) {
    const rows = await page.locator(selector).evaluateAll((trs) =>
      trs
        .map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? ""))
        .filter((cells) => cells.length >= 2)
    ).catch(() => []);
    if (rows.length) return rows;
  }

  throw new Error(`No table rows found for chapter ${chapter}`);
}

function parseRow(cells: string[]): ScrapedRow | null {
  const [code, descriptionEn = "", descriptionZh = "", mfn = "", vat = "", ...rest] = cells;
  const conditions = rest.join(" ").trim();
  if (!validCode(code) || !validRate(mfn) || !validRate(vat)) return null;
  return {
    hs_code_8: code,
    description_en: descriptionEn,
    description_zh: descriptionZh,
    mfn_duty_rate: mfn,
    vat_rate: vat,
    requires_licence: /licen[cs]e|permit|licence/i.test(conditions),
    ciq_inspection: /CIQ|inspection/i.test(conditions),
    supervisory_conditions: conditions,
  };
}

async function main() {
  const started = Date.now();
  const fromChapter = Number(process.argv.find((arg) => arg.startsWith("--from-chapter="))?.split("=")[1] ?? 1);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const emptyChapters: string[] = [];
  let total = 0;
  let validationErrors = 0;

  await page.goto(START_URL, { waitUntil: "domcontentloaded" });
  await page.getByText("中国").first().click().catch(() => {});

  for (let chapter = fromChapter; chapter <= 99; chapter += 1) {
    const ch = String(chapter).padStart(2, "0");
    console.log(`Scraping China chapter ${ch}...`);
    const rows = await retry(async () => {
      await sleep(2000);
      const queryUrl = new URL(START_URL);
      queryUrl.searchParams.set("country", "中国");
      queryUrl.searchParams.set("chapter", ch);
      await page.goto(queryUrl.toString(), { waitUntil: "domcontentloaded" });
      return extractRows(page, ch);
    });

    const validRows: Record<string, unknown>[] = [];
    for (const cells of rows) {
      const parsed = parseRow(cells);
      if (!parsed) {
        validationErrors += 1;
        await logInvalid("mofcom", cells, `invalid row for chapter ${ch}`);
        continue;
      }
      validRows.push(parsed);
    }

    if (!validRows.length) {
      emptyChapters.push(ch);
      console.log(`Chapter ${ch}: 0 valid rows`);
      continue;
    }

    await appendCsv("data/china-hs-codes.csv", [
      "hs_code_8",
      "description_en",
      "description_zh",
      "mfn_duty_rate",
      "vat_rate",
      "requires_licence",
      "ciq_inspection",
      "supervisory_conditions",
    ], validRows);
    total += validRows.length;
    console.log(`Chapter ${ch}: wrote ${validRows.length} rows`);
  }

  await browser.close();
  console.log({
    source: START_URL,
    totalCodesScraped: total,
    validationErrors,
    chaptersWithZeroResults: emptyChapters,
    timeMs: Date.now() - started,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
