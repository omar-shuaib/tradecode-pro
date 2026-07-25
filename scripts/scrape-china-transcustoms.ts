import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

const BASE = "https://www.transcustoms.com";
const DELAY_MS = 1200;
const OUTPUT = "data/china-hs-codes.csv";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseTable(html: string): { code: string; descEn: string; descZh: string }[] {
  const results: { code: string; descEn: string; descZh: string }[] = [];
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>\s*(?:<a[^>]*>)?\s*<b>(\d{10})<\/b>/gi;
  const cellContentRegex = /<td[^>]*>\s*([\s\S]*?)\s*<\/td>/gi;

  const rows = html.split(/<tr[^>]*>/i);
  for (const row of rows) {
    const codeMatch = row.match(/<b>(\d{10})<\/b>/);
    if (!codeMatch) continue;
    const code = codeMatch[1];

    const tdMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 2) continue;
    const contentCell = tdMatches[1][1].replace(/<[^>]*>/g, "\n").trim();
    const lines = contentCell.split("\n").map(l => l.trim()).filter(Boolean);
    let descEn = "";
    let descZh = "";
    for (const line of lines) {
      if (/[\u4e00-\u9fff]/.test(line)) {
        descZh = line;
      } else if (!descEn && line.length > 3) {
        descEn = line;
      }
    }
    if (code && (descEn || descZh)) {
      results.push({ code, descEn, descZh });
    }
  }
  return results;
}

async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (resp.ok) return await resp.text();
      if (resp.status === 429) {
        console.log(`  Rate limited, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      console.log(`  HTTP ${resp.status} for ${url}`);
      return "";
    } catch (e: any) {
      console.log(`  Fetch error: ${e.message}`);
      await sleep(3000);
    }
  }
  return "";
}

async function getHeadings(): Promise<{ heading: string; desc: string }[]> {
  console.log("Fetching HS tree page for all headings...");
  const html = await fetchPage(`${BASE}/HS_tree.htm`);
  if (!html) throw new Error("Could not fetch HS tree");

  const headings: { heading: string; desc: string }[] = [];
  const regex = /href='[^']*word=(\d{4})'[^>]*>Heading \d{4}:\s*([^<;]+)/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    headings.push({ heading: m[1], desc: m[2].trim() });
  }
  return headings;
}

async function searchHeading(heading: string): Promise<{ code: string; descEn: string; descZh: string }[]> {
  const allResults: { code: string; descEn: string; descZh: string }[] = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const url = `${BASE}/China_HS_Search.asp?word=${heading}&selectT=&page=${page}`;
    const html = await fetchPage(url);
    if (!html) break;

    const results = parseTable(html);
    allResults.push(...results);

    hasNext = html.includes(`page=${page + 1}`) && results.length > 0;
    page++;
    if (hasNext) await sleep(500);
  }
  return allResults;
}

async function main() {
  const started = Date.now();
  const headings = await getHeadings();
  console.log(`Found ${headings.length} headings`);

  const existingCodes = new Map<string, { descEn: string; descZh: string }>();
  let totalCodes = 0;
  let emptyHeadings = 0;

  // Resume from checkpoint if exists
  const checkpointFile = "data/china-scrape-checkpoint.json";
  let startIdx = 0;
  if (existsSync(checkpointFile)) {
    const cp = JSON.parse(await readFile(checkpointFile, "utf8"));
    for (const [k, v] of cp.codes) existingCodes.set(k, v);
    startIdx = cp.nextIndex;
    totalCodes = cp.totalCodes;
    emptyHeadings = cp.emptyHeadings;
    console.log(`Resuming from checkpoint at index ${startIdx} (${existingCodes.size} codes so far)`);
  }

  await mkdir(dirname(OUTPUT), { recursive: true });

  for (let i = startIdx; i < headings.length; i++) {
    const { heading, desc } = headings[i];
    process.stdout.write(`[${i + 1}/${headings.length}] Heading ${heading}... `);

    const results = await searchHeading(heading);
    if (results.length === 0) {
      console.log("0 codes (empty)");
      emptyHeadings++;
    } else {
      for (const r of results) {
        const code8 = r.code.slice(0, 8);
        if (!existingCodes.has(code8)) {
          existingCodes.set(code8, { descEn: r.descEn, descZh: r.descZh });
        }
      }
      totalCodes += results.length;
      console.log(`${results.length} codes (${existingCodes.size} unique 8-digit so far)`);
    }

    await sleep(DELAY_MS);

    // Save checkpoint every 50 headings
    if ((i + 1) % 50 === 0 || i === headings.length - 1) {
      const header = "hs_code_8,description_en,description_zh,chapter\n";
      const rows = [...existingCodes.entries()].map(([code, d]) =>
        `"${code}","${d.descEn.replace(/"/g, '""')}","${d.descZh.replace(/"/g, '""')}","${code.slice(0, 2)}"`
      ).join("\n");
      await writeFile(OUTPUT, header + rows + "\n", "utf8");
      await writeFile(checkpointFile, JSON.stringify({
        codes: [...existingCodes.entries()],
        nextIndex: i + 1,
        totalCodes,
        emptyHeadings,
      }), "utf8");
    }
  }

  console.log(`\nDone! ${existingCodes.size} unique 8-digit codes from ${headings.length} headings`);
  console.log(`Total 10-digit codes found: ${totalCodes}`);
  console.log(`Empty headings: ${emptyHeadings}`);
  console.log(`Output: ${OUTPUT}`);
  console.log(`Time: ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
