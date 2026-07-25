import { readFile, writeFile } from "node:fs/promises";

type Candidate = {
  country: "CN";
  hs_code_8: string;
  description_en: string;
  status: string;
  verified_partial_fields?: {
    hs_code_10?: { value: string };
    mfn_duty_rate?: { value: number };
    vat_rate?: { value: number };
  };
};

async function main() {
  const candidates = JSON.parse(await readFile("data/fixtures/unverified-candidates.json", "utf8")) as Candidate[];
  const rows = candidates
    .filter((row) => row.country === "CN")
    .map((row) => ({
      country: "CN",
      hs_code_8: row.hs_code_8,
      hs_code: row.verified_partial_fields?.hs_code_10?.value ?? row.hs_code_8,
      hs_code_10: row.verified_partial_fields?.hs_code_10?.value ?? row.hs_code_8,
      chapter: row.hs_code_8.slice(0, 2),
      section: "85",
      description_en: row.description_en,
      description_zh: "其他电力控制或分配的装置",
      mfn_duty_rate: row.verified_partial_fields?.mfn_duty_rate?.value ?? 8,
      vat_rate: row.verified_partial_fields?.vat_rate?.value ?? 13,
      requires_licence: false,
      ciq_inspection: false,
      is_restricted: false,
      is_prohibited: false,
      supervisory_conditions: null,
      ciq_codes: null,
      data_source: "unverified-candidates.json local demo fixture",
      last_updated: "2026-06-18T00:00:00.000Z",
    }));

  await writeFile("data/fixtures/local-china-seed.json", `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${rows.length} China seed rows to data/fixtures/local-china-seed.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
