/**
 * Product category intelligence — maps natural language product descriptions
 * to the most likely HS chapters. Shared between fallback search/classify
 * and the postgres search adapter.
 */

interface ProductCategory {
  chapters: string[];
  keywords: string[];
}

const PRODUCT_CATEGORIES: ProductCategory[] = [
  { chapters: ["91"], keywords: ["watch", "watches", "clock", "clocks", "timepiece", "wristwatch", "smartwatch", "smart watch", "smart watches", "analog watch", "digital watch", "chronograph", "stopwatch", "timer", "hourmeter", "chronometer"] },
  { chapters: ["85", "91"], keywords: ["smart band", "fitness tracker", "wearable", "smart ring", "smart glass", "smart glasses"] },
  { chapters: ["85"], keywords: ["phone", "smartphone", "mobile phone", "cell phone", "sim card", "modem", "router", "wifi", "bluetooth", "antenna", "telecom", "walkie talkie"] },
  { chapters: ["84", "85"], keywords: ["laptop", "computer", "desktop", "tablet", "keyboard", "mouse", "monitor", "display", "screen", "printer", "scanner", "server", "cpu", "gpu", "ram", "ssd", "hard drive", "usb", "flash drive", "memory card", "card reader", "dock", "hub", "adapter", "charger", "power bank", "cable", "wire", "earphone", "earbuds", "headphone", "speaker", "airpod", "headset", "microphone", "webcam"] },
  { chapters: ["85"], keywords: ["electronic", "electrical", "circuit", "transistor", "diode", "led", "lcd", "oled", "semiconductor", "capacitor", "resistor", "battery", "solar panel", "inverter", "transformer", "relay", "switch", "socket", "plug", "extension cord", "power strip", "ups", "generator"] },
  { chapters: ["85"], keywords: ["television", "tv", "projector", "camera", "dvr", "nvr", "cctv", "security camera", "dashcam", "video recorder", "streaming device"] },
  { chapters: ["87"], keywords: ["car", "vehicle", "automobile", "motorcycle", "truck", "bus", "van", "suv", "sedan", "electric vehicle", "auto part", "car part", "brake", "engine", "transmission", "bumper", "windshield", "tire", "tyre", "wheel", "rim", "headlight", "taillight", "mirror", "seat belt", "airbag"] },
  { chapters: ["88"], keywords: ["airplane", "aircraft", "helicopter", "drone", "uav", "quadcopter", "aircraft part", "aircraft engine", "turbine"] },
  { chapters: ["90", "30"], keywords: ["medical", "surgical", "hospital", "diagnostic", "x-ray", "mri", "ct scan", "ultrasound", "stethoscope", "syringe", "catheter", "implant", "prosthetic", "orthopedic", "dental", "optical", "eyeglasses", "contact lens", "hearing aid", "pacemaker", "ventilator", "oxygen", "mask", "glove", "bandage", "medicine", "drug", "pharmaceutical", "tablet", "capsule", "syrup", "ointment", "vitamin", "supplement"] },
  { chapters: ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"], keywords: ["food", "edible", "fruit", "vegetable", "meat", "fish", "seafood", "dairy", "milk", "cheese", "yogurt", "egg", "bread", "pasta", "noodle", "rice", "cereal", "snack", "chocolate", "candy", "sugar", "honey", "oil", "olive", "sauce", "spice", "tea", "coffee", "juice", "water", "beer", "wine", "alcohol", "beverage", "drink", "soft drink", "baby food", "pet food", "flour", "butter"] },
  { chapters: ["24"], keywords: ["tobacco", "cigarette", "cigar", "vape", "vaping", "e-cigarette", "hookah", "shisha", "snuff", "chewing tobacco"] },
  { chapters: ["61", "62", "63"], keywords: ["clothing", "clothes", "shirt", "t-shirt", "pants", "trousers", "jeans", "shorts", "skirt", "dress", "suit", "jacket", "coat", "blazer", "sweater", "hoodie", "polo", "underwear", "sock", "hat", "cap", "scarf", "glove", "tie", "belt", "shoe", "sneaker", "boot", "sandal", "slipper", "bag", "backpack", "handbag", "luggage", "suitcase", "wallet", "purse"] },
  { chapters: ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"], keywords: ["fabric", "textile", "cloth", "cotton", "silk", "wool", "linen", "nylon", "polyester", "fiber", "yarn", "thread", "ribbon", "lace", "canvas", "denim", "velvet", "satin"] },
  { chapters: ["71"], keywords: ["jewelry", "jewellery", "gold", "silver", "platinum", "diamond", "ruby", "sapphire", "emerald", "pearl", "gem", "gemstone", "precious", "ring", "necklace", "bracelet", "earring", "pendant", "chain", "brooch", "cufflink", "coin", "bullion"] },
  { chapters: ["94"], keywords: ["furniture", "chair", "table", "desk", "sofa", "couch", "bed", "mattress", "wardrobe", "cabinet", "shelf", "bookshelf", "dresser", "lamp", "light", "chandelier", "ceiling fan", "curtain", "blinds", "rug", "carpet", "pillow", "blanket", "towel"] },
  { chapters: ["95"], keywords: ["toy", "toys", "game", "games", "puzzle", "doll", "action figure", "lego", "board game", "video game", "console", "playstation", "xbox", "nintendo", "controller", "gaming", "sport", "sports", "gym", "fitness", "exercise", "yoga", "cycling", "bicycle", "bike", "treadmill", "dumbbell", "barbell", "tennis", "football", "soccer", "basketball", "cricket", "golf", "swimming", "surfing", "skiing", "camping", "hiking", "tent", "sleeping bag", "fishing", "hunting", "archery"] },
  { chapters: ["33"], keywords: ["beauty", "cosmetic", "makeup", "perfume", "fragrance", "cologne", "lotion", "cream", "moisturizer", "serum", "shampoo", "conditioner", "soap", "deodorant", "sunscreen", "lipstick", "mascara", "foundation", "nail polish", "hair dye", "skin care", "skincare"] },
  { chapters: ["39", "40"], keywords: ["plastic", "rubber", "silicone", "pvc", "polyethylene", "polypropylene", "container", "bottle", "cup", "plate", "bowl", "utensil", "straw", "packaging"] },
  { chapters: ["72", "73", "74", "75", "76", "78", "79", "80", "81", "82", "83"], keywords: ["steel", "iron", "copper", "aluminum", "aluminium", "zinc", "tin", "lead", "nickel", "titanium", "alloy", "metal", "pipe", "tube", "beam", "sheet", "plate", "wire", "nail", "screw", "bolt", "nut", "washer", "spring", "hinge", "lock", "key", "tool", "wrench", "pliers", "screwdriver", "hammer", "saw", "drill", "knife", "scissors", "blade", "cutlery"] },
  { chapters: ["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"], keywords: ["chemical", "acid", "alkali", "solvent", "fertilizer", "pesticide", "herbicide", "paint", "dye", "pigment", "ink", "adhesive", "glue", "resin", "detergent", "cleaning", "bleach", "disinfectant"] },
  { chapters: ["25", "68", "69", "70"], keywords: ["cement", "concrete", "brick", "tile", "marble", "granite", "stone", "glass", "mirror", "window", "door", "ceramic", "porcelain", "clay", "sand", "gravel", "limestone", "plaster", "insulation"] },
  { chapters: ["44"], keywords: ["wood", "timber", "lumber", "plywood", "veneer", "parquet", "pellet", "charcoal", "cork"] },
  { chapters: ["48", "49"], keywords: ["paper", "cardboard", "carton", "book", "newspaper", "magazine", "journal", "notebook", "calendar", "poster", "map", "sticker", "label", "ticket", "diary", "album", "photo", "photograph", "print", "envelope", "folder", "binder"] },
  { chapters: ["90"], keywords: ["camera", "lens", "binocular", "telescope", "microscope", "optical", "spectacle", "goggles", "laser", "photography", "tripod", "filter", "flash"] },
  { chapters: ["01", "42"], keywords: ["pet", "dog", "cat", "bird", "fish", "hamster", "rabbit", "animal", "live animal", "aquarium", "cage", "leash", "collar", "pet food"] },
];

export function detectProductCategories(query: string): string[] {
  const qLower = query.toLowerCase().trim();
  const scored: Array<{ chapters: string[]; score: number }> = [];

  for (const cat of PRODUCT_CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (qLower.includes(kw)) {
        score += kw.split(" ").length * 2;
      } else {
        const parts = kw.split(" ");
        if (parts.length > 1 && parts.every(t => qLower.includes(t))) score += 1;
      }
    }
    if (score > 0) scored.push({ chapters: cat.chapters, score });
  }

  if (!scored.length) return [];
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of scored) {
    for (const ch of s.chapters) {
      if (!seen.has(ch)) { seen.add(ch); result.push(ch); }
    }
  }
  return result;
}
