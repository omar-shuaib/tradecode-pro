import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const BATCH_SIZE = 500;

async function main() {
  const db = new PrismaClient();
  const indiaRaw = JSON.parse(await readFile("data/fixtures/local-india-seed.json", "utf8")) as any[];
  const chinaRaw = JSON.parse(await readFile("data/fixtures/local-china-seed.json", "utf8")) as any[];

  console.log(`Loaded ${indiaRaw.length} India rows, ${chinaRaw.length} China rows from local files (before dedup)`);

  // Deduplicate within batches by keeping last occurrence
  const indiaDeduped = new Map<string, any>();
  for (const r of indiaRaw) indiaDeduped.set(r.hs_code, r);
  const india = [...indiaDeduped.values()];
  console.log(`India: ${indiaRaw.length} raw -> ${india.length} unique`);

  const chinaDeduped = new Map<string, any>();
  for (const r of chinaRaw) chinaDeduped.set(r.hs_code_8, r);
  const china = [...chinaDeduped.values()];
  console.log(`China: ${chinaRaw.length} raw -> ${china.length} unique`);

  // --- INDIA ---
  for (let i = 0; i < india.length; i += BATCH_SIZE) {
    const batch = india.slice(i, i + BATCH_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const r of batch) {
      values.push(
        `($${paramIdx},$${paramIdx+1},$${paramIdx+2},$${paramIdx+3},$${paramIdx+4},$${paramIdx+5},$${paramIdx+6},$${paramIdx+7},$${paramIdx+8},$${paramIdx+9},$${paramIdx+10},$${paramIdx+11},$${paramIdx+12},$${paramIdx+13},$${paramIdx+14},$${paramIdx+15})`
      );
      params.push(
        r.hs_code,
        r.chapter,
        r.section ?? null,
        r.description_en,
        r.description_hi ?? null,
        r.bcd_rate ?? null,
        r.igst_rate ?? null,
        r.sws_rate ?? 10,
        r.import_policy ?? "Free",
        r.requires_licence ?? false,
        r.requires_inspection ?? false,
        r.inspection_agency ?? null,
        r.is_restricted ?? false,
        r.is_prohibited ?? false,
        r.data_source ?? null,
        r.last_updated ? new Date(r.last_updated) : new Date()
      );
      paramIdx += 16;
    }

    const sql = `
      INSERT INTO hs_codes_india (hs_code, chapter, section, description_en, description_hi, bcd_rate, igst_rate, sws_rate, import_policy, requires_licence, requires_inspection, inspection_agency, is_restricted, is_prohibited, data_source, last_updated)
      VALUES ${values.join(",")}
      ON CONFLICT (hs_code) DO UPDATE SET
        chapter = EXCLUDED.chapter,
        section = EXCLUDED.section,
        description_en = EXCLUDED.description_en,
        description_hi = EXCLUDED.description_hi,
        bcd_rate = EXCLUDED.bcd_rate,
        igst_rate = EXCLUDED.igst_rate,
        sws_rate = EXCLUDED.sws_rate,
        import_policy = EXCLUDED.import_policy,
        requires_licence = EXCLUDED.requires_licence,
        requires_inspection = EXCLUDED.requires_inspection,
        inspection_agency = EXCLUDED.inspection_agency,
        is_restricted = EXCLUDED.is_restricted,
        is_prohibited = EXCLUDED.is_prohibited,
        data_source = EXCLUDED.data_source,
        last_updated = EXCLUDED.last_updated
    `;

    await db.$executeRawUnsafe(sql, ...params);
    console.log(`India: upserted ${Math.min(i + BATCH_SIZE, india.length)}/${india.length}`);
  }

  // --- CHINA ---
  for (let i = 0; i < china.length; i += BATCH_SIZE) {
    const batch = china.slice(i, i + BATCH_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const r of batch) {
      values.push(
        `($${paramIdx},$${paramIdx+1},$${paramIdx+2},$${paramIdx+3},$${paramIdx+4},$${paramIdx+5},$${paramIdx+6},$${paramIdx+7},$${paramIdx+8},$${paramIdx+9},$${paramIdx+10},$${paramIdx+11},$${paramIdx+12},$${paramIdx+13},$${paramIdx+14},$${paramIdx+15},$${paramIdx+16})`
      );
      params.push(
        r.hs_code_8,
        r.hs_code ?? null,
        r.hs_code_10 ?? null,
        r.chapter,
        r.section ?? null,
        r.description_en,
        r.description_zh,
        r.mfn_duty_rate ?? null,
        r.vat_rate ?? null,
        r.requires_licence ?? false,
        r.ciq_inspection ?? false,
        r.is_restricted ?? false,
        r.is_prohibited ?? false,
        r.supervisory_conditions ?? null,
        r.ciq_codes ?? null,
        r.data_source ?? null,
        r.last_updated ? new Date(r.last_updated) : new Date()
      );
      paramIdx += 17;
    }

    const sql = `
      INSERT INTO hs_codes_china (hs_code_8, hs_code, hs_code_10, chapter, section, description_en, description_zh, mfn_duty_rate, vat_rate, requires_licence, ciq_inspection, is_restricted, is_prohibited, supervisory_conditions, ciq_codes, data_source, last_updated)
      VALUES ${values.join(",")}
      ON CONFLICT (hs_code_8) DO UPDATE SET
        hs_code = EXCLUDED.hs_code,
        hs_code_10 = EXCLUDED.hs_code_10,
        chapter = EXCLUDED.chapter,
        section = EXCLUDED.section,
        description_en = EXCLUDED.description_en,
        description_zh = EXCLUDED.description_zh,
        mfn_duty_rate = EXCLUDED.mfn_duty_rate,
        vat_rate = EXCLUDED.vat_rate,
        requires_licence = EXCLUDED.requires_licence,
        ciq_inspection = EXCLUDED.ciq_inspection,
        is_restricted = EXCLUDED.is_restricted,
        is_prohibited = EXCLUDED.is_prohibited,
        supervisory_conditions = EXCLUDED.supervisory_conditions,
        ciq_codes = EXCLUDED.ciq_codes,
        data_source = EXCLUDED.data_source,
        last_updated = EXCLUDED.last_updated
    `;

    await db.$executeRawUnsafe(sql, ...params);
    console.log(`China: upserted ${Math.min(i + BATCH_SIZE, china.length)}/${china.length}`);
  }

  // Exchange rates
  await db.$executeRawUnsafe(`
    INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source)
    VALUES ('USD', 'INR', 83.5, '2026-05-31', 'Development fixture'), ('USD', 'CNY', 7.25, '2026-05-31', 'Development fixture')
    ON CONFLICT (from_currency, to_currency) DO NOTHING
  `);

  console.log(`\nDone! Seeded ${india.length} India + ${china.length} China rows + 2 exchange rates`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
