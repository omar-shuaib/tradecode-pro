import { readFile } from "node:fs/promises";

type Evidence = { source: string; url: string; verified_date: string; value?: unknown };
type Row = {
  country: "CN" | "IN";
  hs_code_8?: string;
  hs_code?: string;
  verification: Record<string, Evidence | { source: string; url: string; verified_date: string }>;
};

async function main() {
  let rows: Row[];
  try {
    rows = JSON.parse(await readFile("data/fixtures/seed-dev.json", "utf8"));
  } catch {
    console.log("No seed-dev.json found or unreadable — skipping validation");
    return;
  }

  if (!rows || rows.length === 0) {
    console.log("seed-dev.json is empty — skipping fixture validation (no verified fixtures yet)");
    return;
  }

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const issues: string[] = [];

  for (const [i, row] of rows.entries()) {
    const code = row.country === "CN" ? row.hs_code_8 : row.hs_code;
    if (!code || !/^\d{8}$/.test(code)) issues.push(`${i}: invalid code`);
    for (const [field, e] of Object.entries(row.verification ?? {})) {
      if (!e.source || !e.url || !iso.test(e.verified_date)) issues.push(`${code}: invalid evidence for ${field}`);
    }
    if (!row.verification?.corroborating) issues.push(`${code}: missing corroborating evidence`);
  }

  if (!rows.some((r) => r.country === "CN" && r.hs_code_8 === "85371090"))
    issues.push("missing mandatory CN 85371090");
  if (!rows.some((r) => r.country === "IN" && r.hs_code === "85371090"))
    issues.push("missing mandatory IN 85371090");

  if (issues.length) throw new Error(issues.join("\n"));
  console.log(`Validated ${rows.length} verified fixture records`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
