import { readFile, writeFile } from "node:fs/promises";

type SeedRow = {
  country: "IN";
  hs_code: string;
  description_en: string;
  description_hi?: string;
  chapter: string;
  section?: string;
  bcd_rate: number | null;
  igst_rate: number | null;
  sws_rate: number;
  import_policy: string;
  requires_licence: boolean;
  requires_inspection: boolean;
  inspection_agency?: string;
  is_restricted: boolean;
  is_prohibited: boolean;
  data_source: string;
  last_updated: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((value) => value.trim());
}

async function main() {
  const allRows: Record<string, string>[] = [];
  const seenCodes = new Set<string>();

  const fileGroups = [
    {
      label: "datafile",
      paths: [
        "..\\india hs code datafile.csv",
        "C:\\Users\\ADMIN\\OneDrive\\Desktop\\PROJECTS\\Trade Code pro\\india hs code datafile.csv",
      ],
    },
    {
      label: "10digit",
      paths: [
        "..\\indiahscodes.csv",
        "C:\\Users\\ADMIN\\OneDrive\\Desktop\\PROJECTS\\Trade Code pro\\indiahscodes.csv",
      ],
    },
  ];

  for (const group of fileGroups) {
    let csvText: string | null = null;
    for (const inputPath of group.paths) {
      try {
        csvText = await readFile(inputPath, "utf8");
        console.log(`Loaded ${group.label} CSV: ${inputPath}`);
        break;
      } catch {
        // try next path
      }
    }
    if (!csvText) {
      console.log(`Skipping ${group.label} CSV (not found)`);
      continue;
    }
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines.shift() ?? "");
    for (const line of lines) {
      const values = parseCsvLine(line);
      const row = headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = values[index] ?? "";
        return acc;
      }, {});
      allRows.push(row);
    }
  }

  if (!allRows.length) throw new Error("Could not find any India source CSVs.");

  const seedRows: SeedRow[] = [];
  for (const row of allRows) {
    const hsCode = String(row["ITC(HS)"] ?? row.hscode ?? row.hs_code ?? "").replace(/\D/g, "").slice(0, 8);
    if (hsCode.length !== 8) continue;
    if (seenCodes.has(hsCode)) continue;
    seenCodes.add(hsCode);
    const desc = normalizeText(String(row.Description ?? row.description ?? ""));
    const policy = normalizeText(String(row.Policy ?? row.policy ?? ""));
    const condition = normalizeText(String(row.Condition ?? row.condition ?? ""));
    const special85371090 = hsCode === "85371090";
    seedRows.push({
      country: "IN",
      hs_code: hsCode,
      description_en: desc,
      description_hi: undefined,
      chapter: hsCode.slice(0, 2),
      section: undefined,
      bcd_rate: special85371090 ? 15 : null,
      igst_rate: special85371090 ? 18 : null,
      sws_rate: 10,
      import_policy: policy || "Free",
      requires_licence: /licen[cs]e|permit/i.test(policy + " " + condition),
      requires_inspection: /inspection|qat|quarantine|phyto|veterinary/i.test(condition),
      inspection_agency: /inspection/i.test(condition) ? "Specified authority" : undefined,
      is_restricted: /restricted/i.test(policy),
      is_prohibited: /prohibited/i.test(policy),
      data_source: "india-hs-csv local fixture",
      last_updated: "2026-06-18T00:00:00.000Z",
    });
  }

  if (!seedRows.some((row) => row.hs_code === "85371090")) {
    seedRows.unshift({
      country: "IN",
      hs_code: "85371090",
      description_en:
        "Other boards, panels, consoles, desks, cabinets and bases for electric control or distribution, for a voltage not exceeding 1,000 V",
      description_hi: undefined,
      chapter: "85",
      section: "85",
      bcd_rate: 15,
      igst_rate: 18,
      sws_rate: 10,
      import_policy: "Free",
      requires_licence: false,
      requires_inspection: false,
      inspection_agency: undefined,
      is_restricted: false,
      is_prohibited: false,
      data_source: "unverified-candidates.json local demo fixture",
      last_updated: "2026-06-18T00:00:00.000Z",
    });
  }

  await writeFile("data/fixtures/local-india-seed.json", `${JSON.stringify(seedRows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${seedRows.length} India seed rows to data/fixtures/local-india-seed.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
