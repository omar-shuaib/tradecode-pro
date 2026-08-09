import { GoogleGenAI } from "@google/genai";
import { db } from "../db.js";

const MODEL = "gemini-flash-latest";

export async function classify(description: string, country: string) {
  try {
    const limit = Number(process.env.GEMINI_DAILY_REQUEST_LIMIT ?? 250);
    const count = await db.aiClassification.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });

    if (!process.env.GEMINI_API_KEY || count >= limit) return null;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are a customs classification expert. Return ONLY a JSON array of 5 objects for ${country === "BOTH" ? "China, India, and UAE" : country} HS codes for: "${description}".

Rules:
- HS chapters are: 01-97 (2-digit). First identify which HS chapter the product belongs to, then find the most specific 8-digit codes within that chapter.
- A "smart watch" belongs in chapter 91 (watches), NOT chapter 84 (machinery).
- A "phone case" belongs in chapter 42 (bags) or 39 (plastics), NOT chapter 85 (electronics).
- A "protein supplement" belongs in chapter 21 or 22 (food/beverage), NOT chapter 30 (pharmaceuticals).
- Return diverse results across chapters when the product could classify in multiple ways.
- ${country === "BOTH" ? "Spread the 5 results across China, India, and UAE so each country has at least one result." : `All 5 results must be ${country} HS codes.`}

Each object MUST have: country (one of "CN", "IN", "AE"), hsCode (8-digit string), descriptionEn (string), confidence (number 0-100). Rank by confidence descending.`,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const raw = JSON.parse(response.text ?? "[]");
    const countryOrder: ("CN" | "IN" | "AE")[] = ["CN", "IN", "AE"];
    const normalizeCountry = (value: unknown, i: number): "CN" | "IN" | "AE" => {
      const s = String(value ?? "").toUpperCase().replace(/[\s._-]/g, "");
      if (s === "CN" || s === "CHINA" || s === "中国") return "CN";
      if (s === "IN" || s === "INDIA" || s === "印度") return "IN";
      if (s === "AE" || s === "UAE" || s === "阿联酋") return "AE";
      return countryOrder[i % countryOrder.length];
    };

    // Normalize: ensure confidence + a concrete per-item country exist
    const results = (Array.isArray(raw) ? raw : []).map((r: any, i: number) => ({
      country: normalizeCountry(r.country, i),
      hsCode: r.hsCode ?? r.hs_code ?? "unknown",
      descriptionEn: r.descriptionEn ?? r.description_en ?? r.description ?? "",
      confidence: typeof r.confidence === "number" ? r.confidence : Math.max(20, 90 - i * 15),
    }));

    await db.aiClassification.create({ data: { productDescription: description, country, results } });
    return results;
  } catch {
    return null;
  }
}
