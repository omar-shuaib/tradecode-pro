/**
 * Everyday-word → tariff-language query expansion.
 *
 * Tariff schedules never say "fridge" or "lorry"; they say "refrigerator" and
 * "motor vehicles for the transport of goods". Search scores rows by how many
 * query words appear in the description, so a colloquial query finds nothing
 * useful unless it is first rewritten into the words the schedules use.
 *
 * Keys are lower-case and may be multi-word phrases. Each value is the term
 * that actually appears in the CN / IN / AE description text. Keep values
 * short: every word in the value must appear in a description for a top-tier
 * match.
 */
const SYNONYMS: Record<string, string> = {
  // appliances
  fridge: "refrigerator",
  fridges: "refrigerator",
  freezer: "freezer",
  "deep freezer": "freezer",
  ac: "air conditioning",
  "air conditioner": "air conditioning",
  aircon: "air conditioning",
  "washing machine": "washing machine",
  washer: "washing machine",
  dishwasher: "dish washing",
  microwave: "microwave oven",
  hoover: "vacuum cleaner",
  "vacuum": "vacuum cleaner",
  geyser: "water heater",
  boiler: "boiler",
  kettle: "electric water heater",
  cooker: "cooking appliance",
  stove: "cooking appliance",
  hairdryer: "hair dryer",
  // electronics
  tv: "television",
  telly: "television",
  cellphone: "telephone cellular",
  "cell phone": "telephone cellular",
  "mobile phone": "telephone cellular",
  smartphone: "telephone cellular",
  iphone: "telephone cellular",
  android: "telephone cellular",
  mobile: "telephone cellular",
  laptop: "portable automatic data processing machine",
  notebook: "portable automatic data processing machine",
  computer: "automatic data processing machine",
  pc: "automatic data processing machine",
  desktop: "automatic data processing machine",
  tablet: "portable automatic data processing machine",
  "hard drive": "storage unit",
  "hard disk": "storage unit",
  ssd: "solid-state storage",
  "pen drive": "solid-state storage",
  "usb drive": "solid-state storage",
  "flash drive": "solid-state storage",
  headphones: "headphone",
  earphones: "earphone",
  earbuds: "earphone",
  speaker: "loudspeaker",
  speakers: "loudspeaker",
  charger: "static converter",
  adapter: "static converter",
  "power bank": "lithium ion accumulator",
  powerbank: "lithium ion accumulator",
  "lithium battery": "lithium ion accumulator",
  "li-ion battery": "lithium ion accumulator",
  "ev battery": "lithium ion accumulator",
  bulb: "lamp",
  "led bulb": "light-emitting diode lamp",
  "led light": "light-emitting diode lamp",
  torch: "portable electric lamp",
  flashlight: "portable electric lamp",
  cable: "insulated wire cable",
  wire: "insulated wire",
  "circuit breaker": "automatic circuit breaker",
  drone: "unmanned aircraft",
  // vehicles
  lorry: "motor vehicles transport goods",
  truck: "motor vehicles transport goods",
  car: "motor car",
  cars: "motor car",
  automobile: "motor car",
  motorbike: "motorcycle",
  bike: "bicycle",
  cycle: "bicycle",
  scooter: "motorcycle",
  tyre: "tyre",
  tire: "tyre",
  tyres: "tyre",
  tires: "tyre",
  // clothing and textiles
  tshirt: "t-shirt",
  "t shirt": "t-shirt",
  tee: "t-shirt",
  pants: "trousers",
  jeans: "trousers denim",
  jumper: "jersey pullover",
  sweater: "jersey pullover",
  hoodie: "jersey pullover",
  sneakers: "sports footwear",
  trainers: "sports footwear",
  shoes: "footwear",
  shoe: "footwear",
  boots: "footwear",
  sandals: "footwear",
  purse: "handbag",
  backpack: "rucksack",
  luggage: "suitcase",
  // home and misc
  couch: "seat",
  sofa: "seat",
  nappy: "napkin",
  diaper: "napkin",
  nappies: "napkin",
  diapers: "napkin",
  specs: "spectacles",
  glasses: "spectacles",
  sunglasses: "sunglasses",
  fertiliser: "fertilizer",
  aluminum: "aluminium",
  medicine: "medicament",
  medicines: "medicament",
  drugs: "medicament",
  pills: "medicament",
  tablets: "medicament",
  toy: "toy",
  crisps: "potato chips",
  sweets: "sugar confectionery",
  candy: "sugar confectionery",
  biscuit: "biscuit",
  cookies: "biscuit",
  soda: "aerated water",
  "soft drink": "aerated water",
  booze: "spirits",
  liquor: "spirits",
  petrol: "motor spirit",
  gasoline: "motor spirit",
  // spellings that differ between schedules
  color: "colour",
  fiber: "fibre",
  jewelry: "jewellery",
  sulfur: "sulphur",
  gray: "grey",
};

const STOPWORDS = new Set(["for", "of", "the", "and", "with", "a", "an", "in", "to", "or", "on", "by", "from", "used"]);

const PHRASES = Object.keys(SYNONYMS)
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);

/**
 * Rewrite a search query into tariff vocabulary. Queries that are HS codes,
 * or contain no known colloquial term, are returned unchanged.
 */
export function expandQuery(raw: string): string {
  const q = raw.trim();
  if (!q || /^[0-9.\s]+$/.test(q)) return q;

  let text = ` ${q.toLowerCase().replace(/\s+/g, " ")} `;
  for (const phrase of PHRASES) {
    if (text.includes(` ${phrase} `)) text = text.split(` ${phrase} `).join(` ${SYNONYMS[phrase]} `);
  }

  const out: string[] = [];
  for (const word of text.trim().split(" ")) {
    const mapped = SYNONYMS[word];
    for (const w of (mapped ?? word).split(" ")) if (!out.includes(w)) out.push(w);
  }
  // Filler words would otherwise count as "query words" that every matching
  // description has to contain.
  const meaningful = out.filter((w) => !STOPWORDS.has(w));
  const expanded = (meaningful.length ? meaningful : out).join(" ");
  return expanded === q.toLowerCase() ? q : expanded;
}
