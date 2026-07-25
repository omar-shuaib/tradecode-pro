import { readFile, writeFile } from "node:fs/promises";

type LocalChinaRow = {
  country: "CN";
  hs_code_8: string;
  chapter: string;
  description_en: string;
  description_zh: string;
  mfn_duty_rate: number | null;
  vat_rate: number | null;
  requires_licence: boolean;
  ciq_inspection: boolean;
  is_restricted: boolean;
  is_prohibited: boolean;
  supervisory_conditions: string | null;
  ciq_codes: string | null;
  data_source: string;
  last_updated: string;
};

type CheckpointEntry = [string, { descEn: string; descZh: string }];

type CheckpointFile = {
  codes: CheckpointEntry[];
  nextIndex: number;
  totalCodes: number;
  emptyHeadings: number;
};

const NOW = new Date().toISOString();

function scoreRow(row: Record<string, unknown>): number {
  let score = 0;
  if (row.mfn_duty_rate != null) score++;
  if (row.vat_rate != null) score++;
  if (row.supervisory_conditions != null) score++;
  if (row.ciq_codes != null) score++;
  if (row.requires_licence === true) score++;
  if (row.ciq_inspection === true) score++;
  if (row.is_restricted === true) score++;
  if (row.is_prohibited === true) score++;
  return score;
}

async function main() {
  const checkpoint: CheckpointFile = JSON.parse(
    await readFile("data/china-scrape-checkpoint.json", "utf8")
  );

  let existing: LocalChinaRow[] = [];
  try {
    existing = JSON.parse(
      await readFile("data/fixtures/local-china-seed.json", "utf8")
    );
  } catch {
    // file may not exist yet
  }

  const map = new Map<string, LocalChinaRow>();

  // Index existing rows
  for (const row of existing) {
    map.set(row.hs_code_8, row);
  }

  // Add checkpoint rows
  for (const [code8, { descEn, descZh }] of checkpoint.codes) {
    if (map.has(code8)) {
      // Existing row already present — keep it (it has richer data from manual curation)
      continue;
    }

    map.set(code8, {
      country: "CN",
      hs_code_8: code8,
      chapter: code8.slice(0, 2),
      description_en: descEn,
      description_zh: descZh,
      mfn_duty_rate: null,
      vat_rate: null,
      requires_licence: false,
      ciq_inspection: false,
      is_restricted: false,
      is_prohibited: false,
      supervisory_conditions: null,
      ciq_codes: null,
      data_source: "transcustoms.com",
      last_updated: NOW,
    });
  }

  const rows = [...map.values()];

  await writeFile(
    "data/fixtures/local-china-seed.json",
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8"
  );

  console.log(`Wrote ${rows.length} China rows to data/fixtures/local-china-seed.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
