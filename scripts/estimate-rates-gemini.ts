import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";

const BATCH_SIZE = 20;
const DELAY_MS = 1500;
const MODEL = "gemini-flash-latest";

const db = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function estimateChinaRate(hsCode: string) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `What is the current MFN (Most Favoured Nation) import duty rate and VAT rate for China HS code ${hsCode}? Reply with ONLY a JSON object: {"mfn_duty_rate": <number or null>, "vat_rate": <number or null>, "confidence": "high"|"medium"|"low", "note": "<brief reason>"}. Use the current Chinese customs tariff schedule.`,
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });
  return JSON.parse(response.text ?? "{}");
}

async function estimateIndiaRate(hsCode: string) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `What is the current Basic Customs Duty (BCD) rate and IGST rate for India HS code ${hsCode}? Reply with ONLY a JSON object: {"bcd_rate": <number or null>, "igst_rate": <number or null>, "confidence": "high"|"medium"|"low", "note": "<brief reason>"}. Use the current 2025-26 Indian tariff schedule.`,
    config: { responseMimeType: "application/json", temperature: 0.1 },
  });
  return JSON.parse(response.text ?? "{}");
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not set");
    process.exit(1);
  }

  const countryArg = process.argv[2]?.toUpperCase() ?? "ALL";

  // Find codes with null rates
  const chinaCodes =
    countryArg === "ALL" || countryArg === "CN"
      ? await db.chinaHsCode.findMany({
          where: { mfnDutyRate: null },
          orderBy: { hsCode8: "asc" },
          take: 500,
        })
      : [];

  const indiaCodes =
    countryArg === "ALL" || countryArg === "IN"
      ? await db.indiaHsCode.findMany({
          where: { bcdRate: null },
          orderBy: { hsCode: "asc" },
          take: 500,
        })
      : [];

  console.log(`Found ${chinaCodes.length} China codes with null rates, ${indiaCodes.length} India codes with null rates`);

  let chinaUpdated = 0;
  let indiaUpdated = 0;
  let errors = 0;

  // Process China
  for (let i = 0; i < chinaCodes.length; i += BATCH_SIZE) {
    const batch = chinaCodes.slice(i, i + BATCH_SIZE);
    console.log(`China batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chinaCodes.length / BATCH_SIZE)} (${batch.length} codes)`);

    for (const code of batch) {
      try {
        const result = await estimateChinaRate(code.hsCode8);
        if (result.mfn_duty_rate != null || result.vat_rate != null) {
          await db.chinaHsCode.update({
            where: { hsCode8: code.hsCode8 },
            data: {
              mfnDutyRate: result.mfn_duty_rate ?? undefined,
              vatRate: result.vat_rate ?? undefined,
              dataSource: "gemini-estimate-v1",
              lastUpdated: new Date(),
            },
          });
          chinaUpdated++;
          console.log(`  CN ${code.hsCode8}: MFN=${result.mfn_duty_rate}% VAT=${result.vat_rate}% [${result.confidence}]`);
        }
      } catch (err: any) {
        errors++;
        console.error(`  CN ${code.hsCode8} error: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
  }

  // Process India
  for (let i = 0; i < indiaCodes.length; i += BATCH_SIZE) {
    const batch = indiaCodes.slice(i, i + BATCH_SIZE);
    console.log(`India batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(indiaCodes.length / BATCH_SIZE)} (${batch.length} codes)`);

    for (const code of batch) {
      try {
        const result = await estimateIndiaRate(code.hsCode);
        if (result.bcd_rate != null || result.igst_rate != null) {
          await db.indiaHsCode.update({
            where: { hsCode: code.hsCode },
            data: {
              bcdRate: result.bcd_rate ?? undefined,
              igstRate: result.igst_rate ?? undefined,
              dataSource: "gemini-estimate-v1",
              lastUpdated: new Date(),
            },
          });
          indiaUpdated++;
          console.log(`  IN ${code.hsCode}: BCD=${result.bcd_rate}% IGST=${result.igst_rate}% [${result.confidence}]`);
        }
      } catch (err: any) {
        errors++;
        console.error(`  IN ${code.hsCode} error: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. China updated: ${chinaUpdated}, India updated: ${indiaUpdated}, Errors: ${errors}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
