# Fixture verification log

## 2026-06-01: mandatory electrical-panel bilateral demo

Status: **not eligible for `seed-dev.json` yet**.

The mandatory demo code requires field-level confirmation from official publications plus an independent corroborating source. Publicly accessible sources currently expose conflicting or incomplete values, so no tariff value has been committed as verified.

### India `85371090`

- Official IGST evidence: CBIC GST rates list heading `8537` at `18%`.
  - `https://cbic-gst.gov.in/gst-goods-services-rates.html`
- Official ICEGATE result supplied by the user on `2026-06-01`: tariff item `85371090`, description `Other`, unit `KGS`, rate of duty `15%`, import policy `Free`.
  - `https://www.icegate.gov.in/Webappl/Tariff-head-details`
- Official BCD portal: CBIC publishes the Customs Tariff portal, but the public page requires JavaScript and the audit did not obtain a stable code-specific official result.
  - `https://www.cbic.gov.in/htdocs-cbec/customs/cs-tariff`
- Corroborating sources conflict:
  - EximGuru heading `85371000` shows historical BCD `7.5%`, IGST `18%`, and policy `Free`.
    - `https://www.eximguru.com/indian-customs-duty/8537-boards-panels-consoles-desks-cabinets.aspx`
  - Other practical sources expose different BCD values for `85371090`; these are not accepted evidence.

### China `85371090`

- Official GACC public service result supplied by the user on `2026-06-01`: searching eight-digit heading `85371090` returns six ten-digit tariff items. The general `other` item is `8537109090` (`其他电力控制或分配的装置`) with MFN import rate `8%` and ordinary import rate `50%`.
  - `https://online.customs.gov.cn/ocportal/mySearch/`
  - `https://online.customs.gov.cn/ociswebserver/pages/jckspsl/index.html`
- Official VAT evidence supplied by the user on `2026-06-01`: import consumption tax `0`, VAT `13%`.
- The official result does not display CIQ status on the visible table. CIQ remains unresolved.
- Corroborating Transcustoms results are inconsistent between heading and extension views:
  - `https://transcustoms.cn/mobile/Tariff_Search-m.asp?word=85371090`
  - `https://www.transcustoms.cn/Chinese_Tariff_Calculation_Report.asp?hs_code=85371090`

### Required manual resolution

1. Export or capture the official CBIC and DGFT code-specific records for India.
2. Export or capture any official GACC CIQ / quarantine status record for China, if available.
3. Keep the bilateral mapping keyed on the shared six-digit heading `853710` rather than exact eight-digit equality.
4. Commit the pair to `seed-dev.json` only after all populated fields satisfy the two-source rule.
