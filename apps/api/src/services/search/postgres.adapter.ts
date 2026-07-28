import type { CodeResult, Country } from "@tradecode/shared-types";
import { db } from "../../db.js";
import { detectProductCategories } from "../../product-categories.js";
import type { SearchProvider } from "./provider.js";

/**
 * Build a scoring SQL fragment that ranks results by relevance.
 *
 * Scoring tiers:
 *   0. HS code match (query is all digits 4-10 chars):
 *        - Exact match on hsCode            → 1.0
 *        - HS code starts with query        → 0.95
 *        - Same 4-digit chapter             → 0.70
 *   1. Exact phrase match in description   → 0.85
 *   2. ALL query words in description      → 0.65 + word coverage bonus
 *   3. Most (≥50%) query words appear      → 0.35 + word coverage bonus
 *   4. Trigram similarity fallback         → similarity score (0-1)
 *
 * Results are multiplied by a chapter boost:
 *   - If likelyChapters is non-empty and the code's chapter matches → ×1.5
 *   - If likelyChapters is non-empty and the code's chapter doesn't match → ×0.15
 *   - If no categories detected → ×1.0 (no adjustment)
 */
function buildScoreSql(
  col: string,
  codeCol: string,
  paramIndex: number,
  chapterCol: string,
  likelyChapters: string[],
): string {
  const p = `$${paramIndex}`;

  const baseScore = `
    CASE
      WHEN ${p} ~ '^[0-9]{4,10}$' THEN
        CASE
          WHEN lower(${codeCol}) = lower(${p}) THEN 1.0
          WHEN lower(${codeCol}) LIKE lower(${p}) || '%' THEN 0.95
          WHEN substring(lower(${codeCol}), 1, 4) = substring(lower(${p}), 1, 4) THEN 0.70
          ELSE 0.05
        END
      WHEN lower(${col}) = lower(${p}) THEN 0.85
      WHEN position(lower(${p}) IN lower(${col})) > 0 THEN 0.80
      WHEN (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%'
      ) = (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      )
      AND (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      ) > 0
      THEN 0.65 + (0.20 * LEAST(
        (SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%')
        ::float /
        GREATEST((SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$'), 1)
      , 1.0))
      WHEN (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%'
      ) >= (
        SELECT count(*) * 0.5 FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      )
      AND (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      ) > 0
      THEN 0.35 + (0.30 * LEAST(
        (SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%')
        ::float /
        GREATEST((SELECT count(*) FROM unnest(regexp_split_to_array(lower(${p}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$'), 1)
      , 1.0))
      ELSE similarity(${col}, ${p})
    END
  `;

  if (likelyChapters.length === 0) return baseScore;

  const chapterList = likelyChapters.map(c => `'${c}'`).join(", ");
  return `
    CASE
      WHEN ${p} ~ '^[0-9]{4,10}$' THEN
        CASE
          WHEN lower(${codeCol}) = lower(${p}) THEN 1.0
          WHEN lower(${codeCol}) LIKE lower(${p}) || '%' THEN 0.95
          WHEN substring(lower(${codeCol}), 1, 4) = substring(lower(${p}), 1, 4) THEN 0.70
          ELSE 0.05
        END
      WHEN ${chapterCol}::text IN (${chapterList}) THEN LEAST(${baseScore} * 1.5, 1.0)
      ELSE ${baseScore} * 0.15
    END
  `;
}

export class PostgresSearchProvider implements SearchProvider {
  async search(q: string, country: Country, limit = 20) {
    const like = `%${q}%`;
    const likelyChapters = detectProductCategories(q);

    if (country === "BOTH") {
      const perCountry = Math.ceil(limit / 3);
      const rows = await db.$queryRawUnsafe(
        `WITH all_results AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY country ORDER BY score DESC) as rn
          FROM (
            SELECT 'CN' country, hs_code_8 "hsCode", description_en "descriptionEn", description_zh "descriptionLocal", chapter,
              mfn_duty_rate::float "dutyRate", vat_rate::float "secondaryRate", requires_licence "requiresLicence",
              ciq_inspection "requiresInspection", is_restricted "isRestricted", is_prohibited "isProhibited",
              NULL::text "importPolicy", NULL::text "inspectionAgency", supervisory_conditions "supervisoryConditions",
              data_source "dataSource", last_updated::text "lastUpdated",
              ${buildScoreSql("description_en", "hs_code_8", 1, "chapter", likelyChapters)} score
            FROM hs_codes_china
            UNION ALL
            SELECT 'IN', hs_code, description_en, description_hi, chapter, bcd_rate::float, igst_rate::float,
              requires_licence, requires_inspection, is_restricted, is_prohibited, import_policy, inspection_agency,
              NULL, data_source, last_updated::text,
              ${buildScoreSql("description_en", "hs_code", 1, "chapter", likelyChapters)}
            FROM hs_codes_india
            UNION ALL
            SELECT 'AE', hs_code, description_en, description_ar, chapter, customs_duty_rate::float, vat_rate::float,
              FALSE, FALSE, is_restricted, is_prohibited, NULL, NULL, NULL, data_source, last_updated::text,
              ${buildScoreSql("description_en", "hs_code", 1, "chapter", likelyChapters)}
            FROM hs_codes_uae
          ) s
          WHERE score >= 0.06 OR "hsCode" LIKE $2
        )
        SELECT * FROM all_results WHERE rn <= $3
        ORDER BY score DESC
        LIMIT $4`,
        q, like, perCountry, limit
      );
      return rows as CodeResult[];
    }

    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM (
        SELECT 'CN' country, hs_code_8 "hsCode", description_en "descriptionEn", description_zh "descriptionLocal", chapter,
          mfn_duty_rate::float "dutyRate", vat_rate::float "secondaryRate", requires_licence "requiresLicence",
          ciq_inspection "requiresInspection", is_restricted "isRestricted", is_prohibited "isProhibited",
          NULL::text "importPolicy", NULL::text "inspectionAgency", supervisory_conditions "supervisoryConditions",
          data_source "dataSource", last_updated::text "lastUpdated",
          ${buildScoreSql("description_en", "hs_code_8", 1, "chapter", likelyChapters)} score
        FROM hs_codes_china
        UNION ALL
        SELECT 'IN', hs_code, description_en, description_hi, chapter, bcd_rate::float, igst_rate::float,
          requires_licence, requires_inspection, is_restricted, is_prohibited, import_policy, inspection_agency,
          NULL, data_source, last_updated::text,
          ${buildScoreSql("description_en", "hs_code", 1, "chapter", likelyChapters)}
        FROM hs_codes_india
        UNION ALL
        SELECT 'AE', hs_code, description_en, description_ar, chapter, customs_duty_rate::float, vat_rate::float,
          FALSE, FALSE, is_restricted, is_prohibited, NULL, NULL, NULL, data_source, last_updated::text,
          ${buildScoreSql("description_en", "hs_code", 1, "chapter", likelyChapters)}
        FROM hs_codes_uae
      ) s WHERE (country = $2 OR $2 = 'BOTH') AND (score >= 0.06 OR "hsCode" LIKE $3)
      ORDER BY score DESC LIMIT $4`,
      q, country, like, limit
    );
    return rows as CodeResult[];
  }
}
