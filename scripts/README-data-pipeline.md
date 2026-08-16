# Data Pipeline

## Scripts

### seed-batch.ts
Loads `data/fixtures/local-india-seed.json` and `local-china-seed.json`, deduplicates, and upserts into `hs_codes_india` / `hs_codes_china` tables. Uses raw SQL for batch performance.

```bash
npx tsx scripts/seed-batch.ts
```

### update-tariffs.ts
Updates tariff rates from fixture files for codes that already exist in the database.

```bash
npx tsx scripts/update-tariffs.ts
```

### estimate-rates-gemini.ts
Batch-estimates duty rates for codes with null rates using Gemini AI. Results are tagged with `data_source = "gemini-estimate-v1"`.

- Rates marked with `gemini-estimate` show "est." label in the UI
- Run with `CN`, `IN`, or `ALL` argument (default: `ALL`)
- Rate-limited: 1.5s delay between requests, 20 codes per batch
- Requires `GEMINI_API_KEY` env var

```bash
npx tsx scripts/estimate-rates-gemini.ts CN      # China only
npx tsx scripts/estimate-rates-gemini.ts IN      # India only
npx tsx scripts/estimate-rates-gemini.ts ALL     # Both
```

### validate-fixtures.ts
Validates fixture JSON files against expected schema before seeding.

```bash
npx tsx scripts/validate-fixtures.ts
```

### generate-mappings.ts
Generates bilateral mappings between India and China HS codes.

```bash
npx tsx scripts/generate-mappings.ts
```

### Scrapers
- `scrape-india.ts` — Scrapes Indian customs data from ICEGATE
- `scrape-china-transcustoms.ts` — Scrapes Chinese customs data (transcustoms)
- `scrape-china.ts` — Alternative Chinese data scraper

## Data Flow

1. **Scrape** raw data from government sources
2. **Seed** into Supabase via `seed-batch.ts`
3. **Estimate** missing rates via `estimate-rates-gemini.ts`
4. **Map** bilateral codes via `generate-mappings.ts`
5. **Serve** via API (`/api/v1/search`, `/api/v1/duty`)
6. **Display** in frontend with "est." label for AI-estimated rates

## Rate Data Sources

| Source | Tag | UI Label |
|--------|-----|----------|
| Official customs fixture | `official` | (none) |
| AI estimated | `gemini-estimate-v1` | est. |
| Not available | null | n/a |
