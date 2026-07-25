import { GoogleGenAI } from "@google/genai";
import { db } from "../db.js";

const MODEL = "gemini-2.5-flash";

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
      contents: `Return JSON only: five likely ${country} 8-digit HS codes for: ${description}`,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const results = JSON.parse(response.text ?? "[]");
    await db.aiClassification.create({ data: { productDescription: description, country, results } });
    return results;
  } catch {
    return null;
  }
}
