import { readFile, writeFile } from "node:fs/promises";

type UaeRow = {
  hs_code: string;
  chapter: string;
  description_en: string;
  description_ar: string;
  customs_duty_rate: number;
  vat_rate: number;
  excise_rate: number | null;
  is_restricted: boolean;
  is_prohibited: boolean;
  data_source: string;
};

// GCC Common External Tariff duty rates by chapter
// 0% = exempt (food, medicine, books, etc.)
// 5% = standard rate (most goods)
// 50% = alcohol
// 100% = tobacco
function gccDutyRate(chapter: number): number {
  if (chapter === 22) return 50;
  if (chapter === 24) return 100;
  if (chapter >= 1 && chapter <= 5) return 0;
  if (chapter === 6) return 0;
  if (chapter >= 7 && chapter <= 14) return 0;
  if (chapter === 15) return 5;
  if (chapter >= 16 && chapter <= 21) return 5;
  if (chapter === 23) return 5;
  if (chapter >= 25 && chapter <= 27) return 5;
  if (chapter >= 28 && chapter <= 29) return 5;
  if (chapter === 30) return 0;
  if (chapter >= 31 && chapter <= 38) return 5;
  if (chapter >= 39 && chapter <= 40) return 5;
  if (chapter >= 41 && chapter <= 43) return 5;
  if (chapter >= 44 && chapter <= 46) return 5;
  if (chapter >= 47 && chapter <= 49) return 0;
  if (chapter >= 50 && chapter <= 63) return 5;
  if (chapter >= 64 && chapter <= 67) return 5;
  if (chapter >= 68 && chapter <= 70) return 5;
  if (chapter === 71) return 5;
  if (chapter >= 72 && chapter <= 83) return 5;
  if (chapter >= 84 && chapter <= 85) return 5;
  if (chapter >= 86 && chapter <= 89) return 5;
  if (chapter >= 90 && chapter <= 92) return 5;
  if (chapter >= 93) return 5;
  return 5;
}

// Excise tax rates (on top of customs duty)
// Energy drinks 100%, sweetened drinks 50%, tobacco 100%
function exciseRate(chapter: number, hsCode: string): number | null {
  if (chapter === 24) return 100;
  if (chapter === 22) {
    if (hsCode.startsWith("2202")) return 50; // sweetened drinks
    return null; // non-alcoholic beverages without excise
  }
  return null;
}

// VAT rate (UAE standard 5%, some items 0%)
function vatRate(chapter: number): number {
  if (chapter >= 1 && chapter <= 5) return 0;
  if (chapter === 6) return 0;
  if (chapter >= 7 && chapter <= 14) return 0;
  if (chapter === 15) return 5;
  if (chapter >= 16 && chapter <= 24) return 5;
  if (chapter >= 25 && chapter <= 27) return 5;
  if (chapter >= 28 && chapter <= 29) return 5;
  if (chapter === 30) return 0; // medicines zero-rated
  if (chapter >= 31 && chapter <= 38) return 5;
  if (chapter >= 39 && chapter <= 49) return 5;
  if (chapter >= 50 && chapter <= 67) return 5;
  if (chapter >= 68 && chapter <= 71) return 5;
  if (chapter >= 72 && chapter <= 97) return 5;
  return 5;
}

function isRestricted(chapter: number): boolean {
  return [13, 24, 29, 30, 31, 33, 36, 37, 44, 72, 73, 84, 85, 86, 87, 88, 89, 93].includes(chapter);
}

function isProhibited(chapter: number): boolean {
  return [29, 93].includes(chapter);
}

async function main() {
  console.log("Building UAE HS codes from China HS 2022 base...");

  // Read China checkpoint which has the full 8-digit codes
  const checkpoint = JSON.parse(await readFile("data/china-scrape-checkpoint.json", "utf8"));
  
  // Also read existing china seed for richer descriptions
  let chinaSeed: any[] = [];
  try {
    chinaSeed = JSON.parse(await readFile("data/fixtures/local-china-seed.json", "utf8"));
  } catch {}

  // Build description lookup from china seed
  const descLookup = new Map<string, string>();
  for (const row of chinaSeed) {
    if (row.description_en) {
      descLookup.set(row.hs_code_8, row.description_en);
    }
  }

  // Extract all unique 6-digit HS codes from China data
  // China 8-digit = HS 6-digit (WCO) + CN 2-digit extension
  // UAE 8-digit = HS 6-digit (WCO) + GCC 2-digit extension
  const sixDigitMap = new Map<string, { descEn: string; count: number }>();

  for (const [code8, data] of checkpoint.codes) {
    const code6 = code8.slice(0, 6);
    if (!sixDigitMap.has(code6)) {
      sixDigitMap.set(code6, { descEn: data.descEn || "", count: 1 });
    } else {
      sixDigitMap.get(code6)!.count++;
    }
  }

  // Also index from china seed
  for (const row of chinaSeed) {
    const code6 = row.hs_code_8?.slice(0, 6);
    if (code6 && !sixDigitMap.has(code6)) {
      sixDigitMap.set(code6, { descEn: row.description_en || "", count: 1 });
    }
  }

  console.log(`Found ${sixDigitMap.size} unique 6-digit HS codes from China data`);

  // UAE/GCC extends 6-digit to 8 digits
  // Pattern: most codes get "00" at 7th-8th position
  // Some get "01", "02", etc. for subdivisions
  // Catch-all "99" within each subheading

  const uaeCodes = new Map<string, UaeRow>();

  for (const [code6, { descEn }] of sixDigitMap) {
    const chapter = parseInt(code6.slice(0, 2), 10);
    const dutyRate = gccDutyRate(chapter);
    const vat = vatRate(chapter);

    // Primary code: append "00"
    const code8 = code6 + "00";
    const excise = exciseRate(chapter, code8);
    uaeCodes.set(code8, {
      hs_code: code8,
      chapter: String(chapter).padStart(2, "0"),
      description_en: descEn || `HS ${code6} - ${headingName(code6)}`,
      description_ar: "",
      customs_duty_rate: dutyRate,
      vat_rate: vat,
      excise_rate: excise,
      is_restricted: isRestricted(chapter),
      is_prohibited: isProhibited(chapter),
      data_source: "GCC Common External Tariff (HS 2022)",
    });

    // Also add "99" catch-all for each subheading
    const code8catch = code6 + "99";
    if (!uaeCodes.has(code8catch)) {
      uaeCodes.set(code8catch, {
        hs_code: code8catch,
        chapter: String(chapter).padStart(2, "0"),
        description_en: `Other ${descEn || `HS ${code6}`}`.trim(),
        description_ar: "",
        customs_duty_rate: dutyRate,
        vat_rate: vat,
        excise_rate: excise,
        is_restricted: isRestricted(chapter),
        is_prohibited: isProhibited(chapter),
        data_source: "GCC Common External Tariff (HS 2022)",
      });
    }
  }

  // Add well-known UAE-specific codes that may not be in China data
  const extraCodes: Array<{ code8: string; desc: string; duty: number; chapter: string }> = [
    // Chapter 22: Alcohol (50% duty + excise)
    { code8: "22030000", desc: "Beer made from malt", duty: 50, chapter: "22" },
    { code8: "22041000", desc: "Wine of fresh grapes", duty: 50, chapter: "22" },
    { code8: "22042100", desc: "Wine in containers <= 2L", duty: 50, chapter: "22" },
    { code8: "22042900", desc: "Wine in other containers", duty: 50, chapter: "22" },
    { code8: "22043000", desc: "Other grape must", duty: 50, chapter: "22" },
    { code8: "22051000", desc: "Vermouth in containers <= 2L", duty: 50, chapter: "22" },
    { code8: "22059000", desc: "Vermouth in other containers", duty: 50, chapter: "22" },
    { code8: "22060000", desc: "Other fermented beverages", duty: 50, chapter: "22" },
    { code8: "22071000", desc: "Undenatured ethyl alcohol, >= 80% ABV", duty: 50, chapter: "22" },
    { code8: "22072000", desc: "Denatured ethyl alcohol", duty: 50, chapter: "22" },
    { code8: "22082000", desc: "Spirits obtained from grape marc", duty: 50, chapter: "22" },
    { code8: "22083000", desc: "Whiskies", duty: 50, chapter: "22" },
    { code8: "22084000", desc: "Rum and other spirits from sugar cane", duty: 50, chapter: "22" },
    { code8: "22085000", desc: "Gin and Geneva", duty: 50, chapter: "22" },
    { code8: "22086000", desc: "Vodka", duty: 50, chapter: "22" },
    { code8: "22087000", desc: "Liqueurs and cordials", duty: 50, chapter: "22" },
    { code8: "22089000", desc: "Other spirits, liqueurs and other spirituous beverages", duty: 50, chapter: "22" },
    { code8: "22090000", desc: "Vinegar and substitutes for vinegar", duty: 5, chapter: "22" },

    // Chapter 24: Tobacco (100% customs + 100% excise)
    { code8: "24011000", desc: "Unstemmed tobacco for cigarettes", duty: 100, chapter: "24" },
    { code8: "24012000", desc: "Partly or wholly stemmed tobacco", duty: 100, chapter: "24" },
    { code8: "24013000", desc: "Tobacco refuse", duty: 100, chapter: "24" },
    { code8: "24021000", desc: "Cigars and cheroots", duty: 100, chapter: "24" },
    { code8: "24022000", desc: "Cigarettes containing tobacco", duty: 100, chapter: "24" },
    { code8: "24029000", desc: "Other tobacco products for smoking", duty: 100, chapter: "24" },
    { code8: "24031100", desc: "Smoking tobacco, pipe tobacco", duty: 100, chapter: "24" },
    { code8: "24031900", desc: "Other smoking tobacco", duty: 100, chapter: "24" },
    { code8: "24039100", desc: "Homogenised or reconstituted tobacco", duty: 100, chapter: "24" },
    { code8: "24039900", desc: "Other manufactured tobacco", duty: 100, chapter: "24" },
    { code8: "24041100", desc: "Nicotine-containing liquid for e-cigarettes", duty: 100, chapter: "24" },
    { code8: "24041900", desc: "Other smoking/inhaling products", duty: 100, chapter: "24" },
    { code8: "24049000", desc: "Other products containing nicotine", duty: 100, chapter: "24" },

    // Key electronics (Chapter 84-85)
    { code8: "84713000", desc: "Portable digital automatic data processing machines (laptops)", duty: 5, chapter: "84" },
    { code8: "84714100", desc: "Other data processing machines comprising CPU and I/O", duty: 5, chapter: "84" },
    { code8: "84714900", desc: "Other data processing machines presented in the form of systems", duty: 5, chapter: "84" },
    { code8: "84715000", desc: "Digital processing units other than those of heading 84.71", duty: 5, chapter: "84" },
    { code8: "84716000", desc: "Input or output units for automatic data processing machines", duty: 5, chapter: "84" },
    { code8: "84717000", desc: "Storage units for automatic data processing machines", duty: 5, chapter: "84" },
    { code8: "84718000", desc: "Other units of automatic data processing machines", duty: 5, chapter: "84" },
    { code8: "84719000", desc: "Other machines for automatic data processing", duty: 5, chapter: "84" },
    { code8: "85171200", desc: "Telephones for cellular networks (smartphones)", duty: 5, chapter: "85" },
    { code8: "85176200", desc: "Machines for reception/conversion/transmission of voice/data", duty: 5, chapter: "85" },
    { code8: "85232100", desc: "Magnetic media cards incorporating a magnetic stripe", duty: 5, chapter: "85" },
    { code8: "85234000", desc: "Optical media for recording of sound or similar phenomena", duty: 5, chapter: "85" },
    { code8: "85235100", desc: "Solid-state non-volatile storage devices (USB drives, SSDs)", duty: 5, chapter: "85" },
    { code8: "85287200", desc: "Television receivers (colour)", duty: 5, chapter: "85" },
    { code8: "85414000", desc: "Photosensitive semiconductor devices (solar cells)", duty: 0, chapter: "85" },
    { code8: "85423100", desc: "Processors and controllers (CPUs, microprocessors)", duty: 5, chapter: "85" },
    { code8: "85423200", desc: "Memories (RAM, flash)", duty: 5, chapter: "85" },
    { code8: "85423300", desc: "Amplifiers", duty: 5, chapter: "85" },
    { code8: "85423900", desc: "Other electronic integrated circuits", duty: 5, chapter: "85" },

    // Motor vehicles (Chapter 87)
    { code8: "87031000", desc: "Vehicles for travelling on snow; golf cars and similar vehicles", duty: 5, chapter: "87" },
    { code8: "87032100", desc: "Spark-ignition engine, <= 1000 cc", duty: 5, chapter: "87" },
    { code8: "87032200", desc: "Spark-ignition engine, 1000-1500 cc", duty: 5, chapter: "87" },
    { code8: "87032300", desc: "Spark-ignition engine, 1500-3000 cc", duty: 5, chapter: "87" },
    { code8: "87032400", desc: "Spark-ignition engine, > 3000 cc", duty: 5, chapter: "87" },
    { code8: "87034000", desc: "Vehicles with both spark-ignition engine and electric motor", duty: 5, chapter: "87" },
    { code8: "87035000", desc: "Vehicles with both diesel engine and electric motor", duty: 5, chapter: "87" },
    { code8: "87036000", desc: "Vehicles with both spark-ignition engine and electric motor (hybrid)", duty: 5, chapter: "87" },
    { code8: "87037000", desc: "Vehicles with both diesel engine and electric motor (hybrid)", duty: 5, chapter: "87" },
    { code8: "87038000", desc: "Other vehicles, with only electric motor for propulsion", duty: 5, chapter: "87" },
    { code8: "87039000", desc: "Other vehicles", duty: 5, chapter: "87" },

    // Drones (Chapter 88)
    { code8: "88024000", desc: "Unmanned aircraft (drones), MTOW > 15 kg", duty: 5, chapter: "88" },
    { code8: "88060000", desc: "Unmanned aircraft (drones)", duty: 5, chapter: "88" },

    // Medical (Chapter 30 - 0%)
    { code8: "30012000", desc: "Glands and other organs for organotherapeutic uses", duty: 0, chapter: "30" },
    { code8: "30021100", desc: "Vaccines for human medicine", duty: 0, chapter: "30" },
    { code8: "30021200", desc: "Vaccines for veterinary medicine", duty: 0, chapter: "30" },
    { code8: "30021300", desc: "Immunological products", duty: 0, chapter: "30" },
    { code8: "30021900", desc: "Other immunological products", duty: 0, chapter: "30" },
    { code8: "30029000", desc: "Human blood, animal blood for transfusion; vaccines, toxins", duty: 0, chapter: "30" },
    { code8: "30031000", desc: "Medicaments containing penicillins", duty: 0, chapter: "30" },
    { code8: "30032000", desc: "Medicaments containing antibiotics (not penicillins)", duty: 0, chapter: "30" },
    { code8: "30033100", desc: "Medicaments containing insulin", duty: 0, chapter: "30" },
    { code8: "30033900", desc: "Medicaments containing hormones (not insulin)", duty: 0, chapter: "30" },
    { code8: "30034000", desc: "Medicaments containing alkaloids or derivatives", duty: 0, chapter: "30" },
    { code8: "30039000", desc: "Other medicaments, unmixed or put up in measured doses", duty: 0, chapter: "30" },
    { code8: "30041000", desc: "Medicaments containing penicillins, put up in measured doses", duty: 0, chapter: "30" },
    { code8: "30042000", desc: "Medicaments containing antibiotics, put up in measured doses", duty: 0, chapter: "30" },
    { code8: "30043100", desc: "Medicaments containing insulin, put up in measured doses", duty: 0, chapter: "30" },
    { code8: "30043200", desc: "Medicaments containing hormones (not insulin), in measured doses", duty: 0, chapter: "30" },
    { code8: "30043900", desc: "Medicaments containing other hormones, in measured doses", duty: 0, chapter: "30" },
    { code8: "30044000", desc: "Medicaments containing alkaloids or derivatives, in measured doses", duty: 0, chapter: "30" },
    { code8: "30045000", desc: "Medicaments containing vitamins, in measured doses", duty: 0, chapter: "30" },
    { code8: "30049000", desc: "Other medicaments in measured doses", duty: 0, chapter: "30" },

    // Key food items (Chapter 04 - dairy, 0%)
    { code8: "04011000", desc: "Milk and cream, not concentrated, fat <= 1%", duty: 0, chapter: "04" },
    { code8: "04012000", desc: "Milk and cream, not concentrated, 1-6% fat", duty: 0, chapter: "04" },
    { code8: "04014000", desc: "Milk and cream, not concentrated, > 6% fat", duty: 0, chapter: "04" },
    { code8: "04021000", desc: "Milk and cream, concentrated, sugar added", duty: 0, chapter: "04" },
    { code8: "04022100", desc: "Milk and cream, concentrated, fat > 1.5%, sugar not added", duty: 0, chapter: "04" },
    { code8: "04022900", desc: "Other concentrated milk and cream", duty: 0, chapter: "04" },
    { code8: "04029100", desc: "Milk and cream powder, granules, fat > 1.5%", duty: 0, chapter: "04" },
    { code8: "04029900", desc: "Other milk and cream powder", duty: 0, chapter: "04" },
    { code8: "04031000", desc: "Yoghurt", duty: 0, chapter: "04" },
    { code8: "04039000", desc: "Other buttermilk, curdled milk and cream", duty: 0, chapter: "04" },
    { code8: "04041000", desc: "Whey and modified whey", duty: 0, chapter: "04" },
    { code8: "04049000", desc: "Products consisting of natural milk constituents", duty: 0, chapter: "04" },
    { code8: "04051000", desc: "Butter", duty: 0, chapter: "04" },
    { code8: "04059000", desc: "Dairy spreads", duty: 0, chapter: "04" },
    { code8: "04061000", desc: "Fresh cheese (unripened)", duty: 0, chapter: "04" },
    { code8: "04062000", desc: "Grated or powdered cheese", duty: 0, chapter: "04" },
    { code8: "04063000", desc: "Processed cheese, not grated or powdered", duty: 0, chapter: "04" },
    { code8: "04064000", desc: "Blue-veined cheese", duty: 0, chapter: "04" },
    { code8: "04069000", desc: "Other cheese", duty: 0, chapter: "04" },
    { code8: "04071100", desc: "Bird eggs, in shell, for incubation, of fowls", duty: 0, chapter: "04" },
    { code8: "04071900", desc: "Other bird eggs, in shell, for incubation", duty: 0, chapter: "04" },
    { code8: "04072100", desc: "Bird eggs, in shell, fresh, of fowls", duty: 0, chapter: "04" },
    { code8: "04072900", desc: "Other bird eggs, in shell, fresh", duty: 0, chapter: "04" },
    { code8: "04090000", desc: "Natural honey", duty: 0, chapter: "04" },

    // Rice (Chapter 10 - 0%)
    { code8: "10061000", desc: "Rice in husk (paddy)", duty: 0, chapter: "10" },
    { code8: "10062000", desc: "Husked (brown) rice", duty: 0, chapter: "10" },
    { code8: "10063000", desc: "Semi-milled or wholly milled rice", duty: 0, chapter: "10" },
    { code8: "10064000", desc: "Broken rice", duty: 0, chapter: "10" },

    // Sugar (Chapter 17)
    { code8: "17011400", desc: "Raw cane sugar", duty: 5, chapter: "17" },
    { code8: "17019100", desc: "Cane sugar containing added flavouring or colouring", duty: 5, chapter: "17" },
    { code8: "17019900", desc: "Other cane sugar", duty: 5, chapter: "17" },
    { code8: "17021000", desc: "Lactose and lactose syrup", duty: 5, chapter: "17" },
    { code8: "17029000", desc: "Other sugars (glucose, fructose, etc.)", duty: 5, chapter: "17" },

    // Gold (Chapter 71)
    { code8: "71081200", desc: "Gold in semi-manufactured forms", duty: 5, chapter: "71" },
    { code8: "71081300", desc: "Gold in other semi-manufactured forms", duty: 5, chapter: "71" },
    { code8: "71082000", desc: "Gold in powder form", duty: 5, chapter: "71" },
    { code8: "71131100", desc: "Articles of jewellery of silver", duty: 5, chapter: "71" },
    { code8: "71131900", desc: "Articles of jewellery of other precious metal", duty: 5, chapter: "71" },
    { code8: "71132000", desc: "Articles of jewellery of base metal clad with precious metal", duty: 5, chapter: "71" },
    { code8: "71161000", desc: "Articles of natural or cultured pearls", duty: 5, chapter: "71" },
    { code8: "71162000", desc: "Articles of precious or semi-precious stones", duty: 5, chapter: "71" },

    // Cosmetics (Chapter 33)
    { code8: "33030000", desc: "Perfumes and toilet waters", duty: 5, chapter: "33" },
    { code8: "33041000", desc: "Lip make-up preparations", duty: 5, chapter: "33" },
    { code8: "33042000", desc: "Eye make-up preparations", duty: 5, chapter: "33" },
    { code8: "33043000", desc: "Manicure or pedicure preparations", duty: 5, chapter: "33" },
    { code8: "33049100", desc: "Powder, whether or not compressed", duty: 5, chapter: "33" },
    { code8: "33049900", desc: "Other beauty/make-up preparations", duty: 5, chapter: "33" },
    { code8: "33051000", desc: "Shampoos", duty: 5, chapter: "33" },
    { code8: "33052000", desc: "Preparations for permanent waving or straightening", duty: 5, chapter: "33" },
    { code8: "33053000", desc: "Hair lacquers", duty: 5, chapter: "33" },
    { code8: "33059000", desc: "Other preparations for hairdressing", duty: 5, chapter: "33" },

    // Plastic products (Chapter 39)
    { code8: "39231000", desc: "Boxed, cases, crates of plastics", duty: 5, chapter: "39" },
    { code8: "39232100", desc: "Sacks and bags of polymers of ethylene", duty: 5, chapter: "39" },
    { code8: "39233000", desc: "Carboys, bottles, flasks of plastics", duty: 5, chapter: "39" },
    { code8: "39269000", desc: "Other articles of plastics", duty: 5, chapter: "39" },

    // Steel articles (Chapter 73)
    { code8: "73089000", desc: "Structures and parts of structures of iron or steel", duty: 5, chapter: "73" },
    { code8: "73269000", desc: "Other articles of iron or steel", duty: 5, chapter: "73" },

    // Aluminium (Chapter 76)
    { code8: "76011000", desc: "Unwrought aluminium, not alloyed", duty: 5, chapter: "76" },
    { code8: "76012000", desc: "Unwrought aluminium alloys", duty: 5, chapter: "76" },
    { code8: "76041000", desc: "Aluminium bars, rods and profiles", duty: 5, chapter: "76" },
    { code8: "76042100", desc: "Hollow profiles of aluminium alloys", duty: 5, chapter: "76" },
    { code8: "76042900", desc: "Other hollow profiles of aluminium", duty: 5, chapter: "76" },
    { code8: "76061100", desc: "Aluminium alloy plates, sheets and strips, rectangular", duty: 5, chapter: "76" },
    { code8: "76061200", desc: "Aluminium plates, sheets and strips, rectangular", duty: 5, chapter: "76" },
    { code8: "76071100", desc: "Aluminium foil, not backed, rolled but not further worked", duty: 5, chapter: "76" },
    { code8: "76071900", desc: "Other aluminium foil, not backed", duty: 5, chapter: "76" },
    { code8: "76101000", desc: "Aluminium doors, windows and their frames", duty: 5, chapter: "76" },

    // Textiles (Chapters 50-63)
    { code8: "61101100", desc: "Jerseys and pullovers of wool or fine animal hair, knitted", duty: 5, chapter: "61" },
    { code8: "61102000", desc: "Jerseys and pullovers of cotton, knitted", duty: 5, chapter: "61" },
    { code8: "61103000", desc: "Jerseys and pullovers of man-made fibres, knitted", duty: 5, chapter: "61" },
    { code8: "62032200", desc: "Men's ensembles of cotton", duty: 5, chapter: "62" },
    { code8: "62032300", desc: "Men's ensembles of synthetic fibres", duty: 5, chapter: "62" },
    { code8: "62034200", desc: "Men's trousers of cotton", duty: 5, chapter: "62" },
    { code8: "62034300", desc: "Men's trousers of synthetic fibres", duty: 5, chapter: "62" },
    { code8: "62042200", desc: "Women's ensembles of cotton", duty: 5, chapter: "62" },
    { code8: "62044200", desc: "Women's dresses of cotton", duty: 5, chapter: "62" },
    { code8: "62045200", desc: "Women's skirts of cotton", duty: 5, chapter: "62" },
    { code8: "62052000", desc: "Men's shirts of cotton", duty: 5, chapter: "62" },
    { code8: "62053000", desc: "Men's shirts of man-made fibres", duty: 5, chapter: "62" },

    // Footwear (Chapter 64)
    { code8: "64021900", desc: "Sports footwear with rubber/plastic soles and uppers", duty: 5, chapter: "64" },
    { code8: "64029100", desc: "Footwear with rubber/plastic soles, covering the ankle", duty: 5, chapter: "64" },
    { code8: "64029900", desc: "Other footwear with rubber/plastic soles", duty: 5, chapter: "64" },
    { code8: "64035100", desc: "Footwear with leather soles, covering the ankle", duty: 5, chapter: "64" },
    { code8: "64035900", desc: "Other footwear with leather soles", duty: 5, chapter: "64" },
    { code8: "64041100", desc: "Sports footwear with textile uppers", duty: 5, chapter: "64" },
    { code8: "64041900", desc: "Other footwear with textile uppers", duty: 5, chapter: "64" },

    // Toys (Chapter 95)
    { code8: "95030000", desc: "Tricyycles, scooters, pedal cars and similar wheeled toys", duty: 5, chapter: "95" },
    { code8: "95043000", desc: "Coin/token operated games with operating console", duty: 5, chapter: "95" },
    { code8: "95045000", desc: "Video game consoles and machines", duty: 5, chapter: "95" },
    { code8: "95049000", desc: "Other articles for parlour games, puzzles, etc.", duty: 5, chapter: "95" },
    { code8: "95051000", desc: "Festive, carnival or entertainment articles (Christmas)", duty: 5, chapter: "95" },
    { code8: "95069100", desc: "Articles and equipment for gymnastics or athletics", duty: 5, chapter: "95" },
    { code8: "95069900", desc: "Other articles for sport", duty: 5, chapter: "95" },
    { code8: "95071000", desc: "Fishing rods", duty: 5, chapter: "95" },
    { code8: "96081000", desc: "Ball point pens", duty: 5, chapter: "96" },

    // Fertilizers (Chapter 31 - 0%)
    { code8: "31010000", desc: "Animal or vegetable fertilizers, whether or not mixed", duty: 0, chapter: "31" },
    { code8: "31021000", desc: "Urea, whether or not in aqueous solution", duty: 0, chapter: "31" },
    { code8: "31022100", desc: "Ammonium sulphate", duty: 0, chapter: "31" },
    { code8: "31022900", desc: "Other double salts and mixtures of ammonium sulphate", duty: 0, chapter: "31" },
    { code8: "31023000", desc: "Ammonium nitrate, whether or not in aqueous solution", duty: 0, chapter: "31" },
    { code8: "31026000", desc: "Double salts and mixtures of calcium nitrate and ammonium nitrate", duty: 0, chapter: "31" },
    { code8: "31028000", desc: "Mixtures of urea and ammonium nitrate", duty: 0, chapter: "31" },
    { code8: "31029000", desc: "Other mineral or chemical fertilizers, nitrogenous", duty: 0, chapter: "31" },
    { code8: "31031000", desc: "Superphosphates", duty: 0, chapter: "31" },
    { code8: "31039000", desc: "Other mineral or chemical fertilizers, phosphatic", duty: 0, chapter: "31" },
    { code8: "31042000", desc: "Potassium chloride", duty: 0, chapter: "31" },
    { code8: "31043000", desc: "Potassium sulphate", duty: 0, chapter: "31" },
    { code8: "31049000", desc: "Other mineral or chemical fertilizers, potassic", duty: 0, chapter: "31" },
    { code8: "31051000", desc: "Fertilizers in tablets, pellets or similar forms, in packages <= 10 kg", duty: 0, chapter: "31" },
    { code8: "31052000", desc: "Mineral or chemical fertilizers containing N, P, K", duty: 0, chapter: "31" },
    { code8: "31053000", desc: "Diammonium hydrogenorthophosphate", duty: 0, chapter: "31" },
    { code8: "31054000", desc: "Ammonium dihydrogenorthophosphate", duty: 0, chapter: "31" },
    { code8: "31055100", desc: "Fertilizers containing N and P but not K", duty: 0, chapter: "31" },
    { code8: "31055900", desc: "Other fertilizers containing N and P", duty: 0, chapter: "31" },
    { code8: "31056000", desc: "Fertilizers containing P and K but not N", duty: 0, chapter: "31" },
    { code8: "31059000", desc: "Other fertilizers", duty: 0, chapter: "31" },

    // Books and printed matter (Chapter 49 - 0%)
    { code8: "49011000", desc: "Printed books, brochures, leaflets in single sheets", duty: 0, chapter: "49" },
    { code8: "49019900", desc: "Other printed books, brochures, leaflets", duty: 0, chapter: "49" },
    { code8: "49021000", desc: "Newspapers, journals and periodicals, published <= 4x/week", duty: 0, chapter: "49" },
    { code8: "49029000", desc: "Other newspapers, journals and periodicals", duty: 0, chapter: "49" },
    { code8: "49030000", desc: "Children's picture books and painting books", duty: 0, chapter: "49" },
    { code8: "49040000", desc: "Music, printed or in manuscript", duty: 0, chapter: "49" },
    { code8: "49051000", desc: "Globes", duty: 0, chapter: "49" },
    { code8: "49059100", desc: "Topographical plans and charts", duty: 0, chapter: "49" },
    { code8: "49059900", desc: "Other maps and hydrographic charts", duty: 0, chapter: "49" },
    { code8: "49060000", desc: "Plans, drawings and photographs", duty: 0, chapter: "49" },
    { code8: "49070000", desc: "Stamps, cheque books, banknotes, title deeds", duty: 0, chapter: "49" },
    { code8: "49081000", desc: "Transfers (decalcomanias), self-adhesive, printed", duty: 0, chapter: "49" },
    { code8: "49089000", desc: "Other transfers (decalcomanias)", duty: 0, chapter: "49" },
    { code8: "49090000", desc: "Printed or illustrated postcards", duty: 0, chapter: "49" },
    { code8: "49100000", desc: "Calendars of any kind, printed", duty: 0, chapter: "49" },
    { code8: "49111000", desc: "Trade advertising material, catalogues and prospectuses", duty: 0, chapter: "49" },
    { code8: "49119100", desc: "Printed pictures and photographs", duty: 0, chapter: "49" },
    { code8: "49119900", desc: "Other printed matter", duty: 0, chapter: "49" },
  ];

  // Add extra codes
  for (const extra of extraCodes) {
    if (!uaeCodes.has(extra.code8)) {
      uaeCodes.set(extra.code8, {
        hs_code: extra.code8,
        chapter: extra.chapter,
        description_en: extra.desc,
        description_ar: "",
        customs_duty_rate: extra.duty,
        vat_rate: extra.duty === 0 ? 0 : 5,
        excise_rate: exciseRate(parseInt(extra.chapter), extra.code8),
        is_restricted: isRestricted(parseInt(extra.chapter)),
        is_prohibited: isProhibited(parseInt(extra.chapter)),
        data_source: "GCC Common External Tariff (HS 2022)",
      });
    }
  }

  const rows = [...uaeCodes.values()].sort((a, b) => a.hs_code.localeCompare(b.hs_code));

  await writeFile(
    "data/fixtures/local-uae-seed.json",
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8"
  );

  console.log(`Wrote ${rows.length} UAE HS codes to data/fixtures/local-uae-seed.json`);
  console.log(`Chapters covered: ${[...new Set(rows.map(r => r.chapter))].sort().length}`);
  console.log(`Duty rate breakdown:`);
  const rateBreakdown = new Map<number, number>();
  for (const row of rows) {
    rateBreakdown.set(row.customs_duty_rate, (rateBreakdown.get(row.customs_duty_rate) || 0) + 1);
  }
  for (const [rate, count] of [...rateBreakdown.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${rate}%: ${count} codes`);
  }
}

function headingName(code6: string): string {
  const heading = code6.slice(0, 4);
  const names: Record<string, string> = {
    "0101": "Live horses, asses, mules and hinnies",
    "0102": "Live bovine animals",
    "0103": "Live swine",
    "0104": "Live sheep and goats",
    "0105": "Live poultry",
    "0106": "Other live animals",
    "0201": "Meat of bovine animals, fresh or chilled",
    "0202": "Meat of bovine animals, frozen",
    "0203": "Meat of swine, fresh, chilled or frozen",
    "0204": "Meat of sheep or goats, fresh, chilled or frozen",
    "0205": "Meat of horses, asses, mules or hinnies, fresh, chilled or frozen",
    "0206": "Edible offal of bovine animals, swine, sheep, goats, horses, etc.",
    "0207": "Meat and edible offal of poultry",
    "0208": "Other meat and edible meat offal",
    "0209": "Pig fat, poultry fat, rendered, etc.",
    "0210": "Mea and edible meat offal, salted, in brine, dried or smoked",
    "0301": "Live fish",
    "0302": "Fish, fresh or chilled, excluding fillets",
    "0303": "Fish, frozen, excluding fillets",
    "0304": "Fish fillets and other fish meat, fresh or frozen",
    "0305": "Fish, dried, salted, in brine, smoked",
    "0306": "Crustaceans, live, fresh, chilled, frozen, etc.",
    "0307": "Molluscs, live, fresh, chilled, frozen, etc.",
    "0308": "Other aquatic invertebrates",
    "0309": "Aquatic animal products not elsewhere specified",
    "0401": "Milk and cream, not concentrated",
    "0402": "Milk and cream, concentrated or sweetened",
    "0403": "Buttermilk, curdled milk, yoghurt",
    "0404": "Whey and products of natural milk constituents",
    "0405": "Butter and dairy spreads",
    "0406": "Cheese and curd",
    "0407": "Bird eggs, in shell",
    "0408": "Bird eggs, not in shell",
    "0409": "Natural honey",
    "0410": "Edible products of animal origin, not elsewhere specified",
    "0501": "Human hair, unworked",
    "0502": "Pigs', hogs' or boars' bristles and hair",
    "0504": "Guts, bladders and stomachs of animals",
    "0505": "Skins and other parts of birds, with feathers",
    "0506": "Bones and horn-cores, unworked",
    "0507": "Ivory, tortoise-shell, horn-cores, etc.",
    "0508": "Coral and similar materials, unworked",
    "0510": "Ambergris, civet, musk, cantharides",
    "0511": "Animal products not elsewhere specified",
    "0601": "Bulbs, tubers, roots, etc.",
    "0602": "Live plants, including trees, shrubs and bulbs",
    "0603": "Cut flowers and flower buds",
    "0604": "Foliage, branches and other parts of plants",
    "0701": "Potatoes, fresh or chilled",
    "0702": "Tomatoes, fresh or chilled",
    "0703": "Onions, shallots, garlic, leeks, etc.",
    "0704": "Cabbages, cauliflowers, kale, etc.",
    "0705": "Lettuce and chicory",
    "0706": "Carrots, turnips, beetroot, etc.",
    "0707": "Cucumbers and gherkins",
    "0708": "Leguminous vegetables, shelled or unshelled",
    "0709": "Other vegetables, fresh or chilled",
    "0710": "Vegetables, frozen",
    "0711": "Vegetables provisionally preserved",
    "0712": "Dried vegetables, whole, cut, sliced or broken",
    "0713": "Dried leguminous vegetables, shelled",
    "0714": "Manioc, arrowroot, salep, etc.",
    "0799": "Other fresh or dried vegetables",
    "0801": "Coanuts, Brazil nuts, cashew nuts, etc.",
    "0802": "Other nuts, fresh or dried",
    "0803": "Bananas and plantains",
    "0804": "Dates, figs, pineapples, etc.",
    "0805": "Citrus fruit, fresh or dried",
    "0806": "Grapes, fresh or dried",
    "0807": "Melons and papayas",
    "0808": "Apples, pears and quinces",
    "0809": "Apricots, cherries, peaches, plums, etc.",
    "0810": "Other fresh fruit",
    "0811": "Fruit and nuts, frozen",
    "0812": "Fruit and nuts, provisionally preserved",
    "0813": "Dried fruit, other than that of heading 08.01-08.06",
    "0814": "Peel of citrus fruit or melons, fresh or dried",
    "0899": "Other fruit",
    "0901": "Coffee, whether or not roasted",
    "0902": "Tea, whether or not flavoured",
    "0903": "Maté",
    "0904": "Pepper and capsicum",
    "0905": "Vanilla",
    "0906": "Cinnamon and cinnamon-tree flowers",
    "0907": "Cloves",
    "0908": "Nutmeg, mace and cardamoms",
    "0909": "Seeds of anise, badian, fennel, coriander, etc.",
    "0910": "Ginger, saffron, turmeric, thyme, curry, etc.",
    "0999": "Other spices",
    "1001": "Wheat and meslin",
    "1002": "Rye",
    "1003": "Barley",
    "1004": "Oats",
    "1005": "Maize (corn)",
    "1006": "Rice",
    "1007": "Grain sorghum",
    "1008": "Buckwheat, millet, canary seed, etc.",
    "1099": "Other cereals",
    "1101": "Wheat flour or meslin flour",
    "1102": "Cereal flours, other than wheat or meslin",
    "1103": "Cereal groats, meal and pellets",
    "1104": "Cereal grains otherwise worked",
    "1105": "Flour, meal, powder, flakes, granules, pellets of potatoes",
    "1106": "Flour, meal, powder of dried leguminous vegetables",
    "1107": "Malt, whether or not roasted",
    "1108": "Starches; inulin",
    "1109": "Wheat gluten, whether or not dried",
    "1199": "Other cereal preparations",
    "8471": "Automatic data processing machines",
    "8517": "Telephone sets, smartphones",
    "8523": "Discs, tapes, USB drives, memory cards",
    "8528": "Monitors, projectors, TVs",
    "8541": "Semiconductor devices, solar cells, LEDs",
    "8542": "Electronic integrated circuits",
    "8703": "Motor cars and vehicles",
    "8802": "Aircraft and spacecraft",
    "8806": "Unmanned aircraft (drones)",
    "3001": "Glands and organs for organotherapeutic uses",
    "3002": "Human/animal blood, vaccines, toxins",
    "3003": "Medicaments, unmixed",
    "3004": "Medicaments in measured doses",
    "3303": "Perfumes and toilet waters",
    "3304": "Beauty/make-up preparations",
    "3305": "Hair preparations",
    "3923": "Plastic articles for packaging",
    "3926": "Other articles of plastics",
    "4901": "Printed books, brochures, leaflets",
    "4907": "Stamps, cheque books, banknotes",
    "6203": "Men's suits, trousers, shorts",
    "6204": "Women's suits, dresses, skirts",
    "6205": "Men's shirts",
    "6402": "Footwear with rubber/plastic soles",
    "6403": "Footwear with leather soles",
    "6404": "Footwear with textile uppers",
    "7108": "Gold in semi-manufactured forms",
    "7113": "Articles of jewellery",
    "7308": "Structures of iron or steel",
    "7601": "Unwrought aluminium",
    "7604": "Aluminium bars, rods, profiles",
    "9503": "Toys, tricycles, scooters",
    "9504": "Video game consoles, games",
    "9608": "Ball point pens",
  };
  return names[heading] || `Chapter ${code6.slice(0, 2)}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
