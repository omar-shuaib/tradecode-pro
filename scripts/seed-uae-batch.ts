import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const raw = await readFile("data/fixtures/local-uae-seed.json", "utf8");
  const codes: any[] = JSON.parse(raw);

  console.log(`Seeding ${codes.length} UAE HS codes...`);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH);
    const values = batch.map(c =>
      `('${c.hs_code}', '${c.chapter}', '${(c.description_en || "").replace(/'/g, "''")}', '${(c.description_ar || "").replace(/'/g, "''")}', ${c.customs_duty_rate}, ${c.vat_rate}, ${c.excise_rate ?? "NULL"}, ${c.is_restricted}, ${c.is_prohibited}, '${c.data_source || "GCC Common External Tariff"}')`
    ).join(",\n");

    await prisma.$executeRawUnsafe(`
      INSERT INTO hs_codes_uae (hs_code, chapter, description_en, description_ar, customs_duty_rate, vat_rate, excise_rate, is_restricted, is_prohibited, data_source)
      VALUES ${values}
      ON CONFLICT (hs_code) DO UPDATE SET
        description_en = EXCLUDED.description_en,
        description_ar = EXCLUDED.description_ar,
        customs_duty_rate = EXCLUDED.customs_duty_rate,
        vat_rate = EXCLUDED.vat_rate,
        excise_rate = EXCLUDED.excise_rate,
        is_restricted = EXCLUDED.is_restricted,
        is_prohibited = EXCLUDED.is_prohibited,
        last_updated = NOW()
    `);
    inserted += batch.length;
    process.stdout.write(`  Upserted ${inserted}/${codes.length}\r`);
  }

  console.log(`\nDone. Upserted ${inserted} UAE HS codes.`);

  const count: any[] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM hs_codes_uae`;
  console.log(`Total UAE codes in DB: ${count[0].cnt}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
