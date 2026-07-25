import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const raw = await readFile("data/china-scrape-checkpoint.json", "utf8");
  const cp = JSON.parse(raw);

  const codes: { hs_code_8: string; description_en: string; description_zh: string; chapter: string }[] = cp.codes.map(([code, d]: [string, any]) => ({
    hs_code_8: code,
    description_en: d.descEn || "",
    description_zh: d.descZh || "",
    chapter: code.slice(0, 2),
  }));

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH);
    const values = batch.map(c =>
      `('${c.hs_code_8}', '${c.description_en.replace(/'/g, "''")}', '${c.description_zh.replace(/'/g, "''")}', '${c.chapter}')`
    ).join(",\n");

    await prisma.$executeRawUnsafe(`
      INSERT INTO hs_codes_china (hs_code_8, description_en, description_zh, chapter)
      VALUES ${values}
      ON CONFLICT (hs_code_8) DO UPDATE SET
        description_en = EXCLUDED.description_en,
        description_zh = EXCLUDED.description_zh,
        last_updated = NOW()
    `);
    inserted += batch.length;
    process.stdout.write(`  Upserted ${inserted}/${codes.length}\r`);
  }

  console.log(`\nDone. Upserted ${inserted} China HS codes.`);

  const count: any[] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM hs_codes_china`;
  console.log(`Total China codes in DB: ${count[0].cnt}`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
