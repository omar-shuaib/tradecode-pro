/**
 * Refresh the USD reference exchange rates used by the duty calculator.
 *
 *   npx tsx scripts/update-fx.ts            # fetch, show old → new, write
 *   npx tsx scripts/update-fx.ts --dry-run  # fetch and show, write nothing
 *
 * The PRD calls for a fixed reference rate refreshed weekly rather than a live
 * FX feed, so this is meant to be run by hand (or a weekly scheduled job).
 * Source: open.er-api.com (ExchangeRate-API free endpoint, no key required).
 * A rate that moves more than 15% from the stored value is refused, because
 * that is far more likely to be a bad response than a real move.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const CURRENCIES = ["INR", "CNY", "AED"] as const;
const SOURCE = "open.er-api.com (ExchangeRate-API)";
const MAX_MOVE = 0.15;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`FX source returned HTTP ${res.status}`);
  const body = (await res.json()) as { result: string; time_last_update_unix: number; rates: Record<string, number> };
  if (body.result !== "success") throw new Error(`FX source returned result "${body.result}"`);
  const effectiveDate = new Date(new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10));

  const db = new PrismaClient();
  try {
    for (const toCurrency of CURRENCIES) {
      const next = body.rates[toCurrency];
      if (!Number.isFinite(next) || next <= 0) throw new Error(`No usable ${toCurrency} rate in the FX response`);
      const key = { fromCurrency_toCurrency: { fromCurrency: "USD", toCurrency } };
      const current = await db.exchangeRate.findUnique({ where: key });
      const old = current ? Number(current.rate) : null;
      if (old && Math.abs(next - old) / old > MAX_MOVE) {
        throw new Error(`${toCurrency} moved ${old} → ${next} (more than ${MAX_MOVE * 100}%). Refusing to write; check the source.`);
      }
      console.log(`USD→${toCurrency}: ${old ?? "none"} → ${next.toFixed(4)} (effective ${effectiveDate.toISOString().slice(0, 10)})${dryRun ? " [dry run]" : ""}`);
      if (dryRun) continue;
      const data = { rate: next, effectiveDate, source: SOURCE, updatedBy: "scripts/update-fx.ts" };
      await db.exchangeRate.upsert({ where: key, create: { fromCurrency: "USD", toCurrency, ...data }, update: data });
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err).replace(/postgres(ql)?:\/\/\S+/g, "<database url>"));
  process.exit(1);
});
