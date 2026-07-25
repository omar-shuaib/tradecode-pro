# TradeCode Pro

Public China-India HS code search, classification, comparison, and landed-cost calculator.

## Local development

Prerequisites: Node.js 24 LTS, npm, and Docker.

```powershell
Copy-Item .env.example .env
docker compose -f infrastructure/docker-compose.yml up
npm run seed -- --fixtures
npm run dev
```

## Weekly maintenance

Log into Supabase, open `exchange_rates`, and update the USD-to-INR and USD-to-CNY rows. Estimated time: 2 minutes.

## Data collection

Before running a scraper, complete the live policy check recorded in `scripts/SCRAPER-COMPLIANCE.md`. If a source disallows scraping, stop. See the troubleshooting notes in that file for blocked requests.

## Future: upgrading search to Typesense

PostgreSQL search is the v1 provider. See [UPGRADE.md](./UPGRADE.md) for the optional Typesense path.
