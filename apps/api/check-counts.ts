import { PrismaClient } from "@prisma/client";
async function main() {
  const db = new PrismaClient();
  const tables = ["hs_codes_china", "hs_codes_india", "bilateral_mappings", "synonyms", "exchange_rates"];
  for (const t of tables) {
    const r = await db.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM ${t}`);
    console.log(`${t}: ${(r as any)[0].cnt}`);
  }
  await db.$disconnect();
}
main();
