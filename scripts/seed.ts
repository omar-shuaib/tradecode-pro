import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

async function main(){
  const db=new PrismaClient();
  const useFixtures=process.argv.includes("--fixtures") || process.env.npm_config_fixtures === "true";
  const useLocalFiles=process.argv.includes("--local-files") || process.env.npm_config_local_files === "true";
  if(!useFixtures && !useLocalFiles)throw new Error("Use --fixtures for verified development records or --local-files to load the converted India seed.");
  const rows=useLocalFiles
    ? {
        india: JSON.parse(await readFile("data/fixtures/local-india-seed.json","utf8")) as any[],
        china: JSON.parse(await readFile("data/fixtures/local-china-seed.json","utf8")) as any[],
      }
    : {india: [], china: JSON.parse(await readFile("data/fixtures/seed-dev.json","utf8")) as any[]};
  if(useLocalFiles && !rows.india.length && !rows.china.length)throw new Error("No local seed rows exist yet. Run scripts/build-india-seed.ts and scripts/build-china-seed.ts first.");
  if(!useLocalFiles && !rows.china.length)throw new Error("No verified fixture rows exist yet. Populate seed-dev.json only after two-source verification.");
  if(useLocalFiles){
    for(const r of rows.india)await db.indiaHsCode.upsert({where:{hsCode:r.hs_code},create:{hsCode:r.hs_code,chapter:r.chapter,section:r.section??null,descriptionEn:r.description_en,descriptionHi:r.description_hi??null,bcdRate:r.bcd_rate??null,igstRate:r.igst_rate??null,swsRate:r.sws_rate??10,importPolicy:r.import_policy,requiresLicence:r.requires_licence,requiresInspection:r.requires_inspection,inspectionAgency:r.inspection_agency??null,isRestricted:r.is_restricted,isProhibited:r.is_prohibited,dataSource:r.data_source,lastUpdated:new Date(r.last_updated)},update:{chapter:r.chapter,section:r.section??null,descriptionEn:r.description_en,descriptionHi:r.description_hi??null,bcdRate:r.bcd_rate??null,igstRate:r.igst_rate??null,swsRate:r.sws_rate??10,importPolicy:r.import_policy,requiresLicence:r.requires_licence,requiresInspection:r.requires_inspection,inspectionAgency:r.inspection_agency??null,isRestricted:r.is_restricted,isProhibited:r.is_prohibited,dataSource:r.data_source,lastUpdated:new Date(r.last_updated)}});
    for(const r of rows.china)await db.chinaHsCode.upsert({where:{hsCode8:r.hs_code_8},create:{hsCode8:r.hs_code_8,hsCode:r.hs_code,hsCode10:r.hs_code_10,chapter:r.chapter,section:r.section,descriptionEn:r.description_en,descriptionZh:r.description_zh,mfnDutyRate:r.mfn_duty_rate,vatRate:r.vat_rate,requiresLicence:r.requires_licence,ciqInspection:r.ciq_inspection,isRestricted:r.is_restricted,isProhibited:r.is_prohibited,supervisoryConditions:r.supervisory_conditions,ciqCodes:r.ciq_codes,dataSource:r.data_source,lastUpdated:new Date(r.last_updated)},update:{hsCode:r.hs_code,hsCode10:r.hs_code_10,chapter:r.chapter,section:r.section,descriptionEn:r.description_en,descriptionZh:r.description_zh,mfnDutyRate:r.mfn_duty_rate,vatRate:r.vat_rate,requiresLicence:r.requires_licence,ciqInspection:r.ciq_inspection,isRestricted:r.is_restricted,isProhibited:r.is_prohibited,supervisoryConditions:r.supervisory_conditions,ciqCodes:r.ciq_codes,dataSource:r.data_source,lastUpdated:new Date(r.last_updated)}});
  }else{
    for(const {verification,...r} of rows.china){if(r.country==="CN")await db.chinaHsCode.upsert({where:{hsCode8:r.hs_code_8},create:r.data,update:r.data});else await db.indiaHsCode.upsert({where:{hsCode:r.hs_code},create:r.data,update:r.data})}
  }
  for(const [toCurrency,rate] of [["INR",83.5],["CNY",7.25]] as const)await db.exchangeRate.upsert({where:{fromCurrency_toCurrency:{fromCurrency:"USD",toCurrency}},create:{fromCurrency:"USD",toCurrency,rate,effectiveDate:new Date("2026-05-31"),source:"Development fixture - update before deployment"},update:{}});
  console.log(`Seeded ${rows.india.length + rows.china.length} ${useLocalFiles?"local":"verified fixture"} records`);
  await db.$disconnect()
}
main().catch(error=>{console.error(error);process.exitCode=1});
