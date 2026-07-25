# Scraper compliance gate

Do not run either scraper against a live source until a contributor has reviewed the current `robots.txt` and terms for each target and recorded the result below. Stop if scraping is disallowed.

| Source | robots.txt checked | terms checked | permitted | checked by | checked date | notes |
| --- | --- | --- | --- | --- | --- | --- |
| data.gov.in | checked | checked | blocked for generic crawling | Codex | 2026-06-01 | `robots.txt` disallows generic automated crawling. Terms permit accurate reproduction of published datasets with attribution. Use only an explicitly permitted resource download or API route after manual confirmation. |
| eximguru.com | pending | pending | pending | | | |
| wmsw.mofcom.gov.cn | checked | checked | permitted | ADMIN | 2026-07-24 | Entry page and tax query page confirmed. User authorized scraper run. China HS tariff data portal is public. Use the portal path for the China scraper. |
| transcustoms.com | pending | pending | pending | | | |

## Troubleshooting data collection

If a primary source blocks requests, stop the run and record the failure. Do not add proxy rotation, alternate-source fallback, or anti-bot evasion.

## Verification notes

- `data.gov.in` terms: https://www.data.gov.in/terms-of-use
- `data.gov.in` robots policy: https://www.data.gov.in/robots.txt
- Do not run `npm run scrape-india` until `DATA_GOV_IN_CSV_URL` is confirmed to be an explicitly permitted resource-download or API URL and the two remaining source checks are completed.
- MOFCOM compliance cleared 2026-07-24. `npm run scrape-china` may proceed.
