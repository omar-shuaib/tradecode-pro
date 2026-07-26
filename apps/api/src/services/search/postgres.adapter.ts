import type { CodeResult, Country } from "@tradecode/shared-types";
import { db } from "../../db.js";
import type { SearchProvider } from "./provider.js";

/**
 * Build a scoring SQL fragment that ranks results by relevance.
 *
 * Scoring tiers:
 *   1. Exact phrase match in description         → 1.0
 *   2. ALL query words appear in description     → 0.7 + word coverage bonus
 *   3. Most (≥50%) query words appear            → 0.4 + word coverage bonus
 *   4. Trigram similarity fallback               → similarity score (0-1)
 *
 * Within each tier, results are sorted by score descending.
 */
function buildScoreSql(col: string, paramIndex: number): string {
  // We build a CASE expression that produces a relevance score 0-1.
  // $N is the raw query, $N+1 is the ILIKE pattern, $N+2 is the word array.
  // For simplicity, we use a single parameter and handle word splitting in JS.
  //
  // The SQL uses:
  //   - position(query IN lower(col)) for phrase match
  //   - regexp_split_to_array(lower(query), '\s+') for word tokens
  //   - array containment for word matching
  //   - similarity() as fallback
  //
  // We return: score, and also a "match_quality" text for debugging.
  return `
    CASE
      WHEN lower(${col}) = lower($${paramIndex}) THEN 1.0
      WHEN position(lower($${paramIndex}) IN lower(${col})) > 0 THEN 0.95
      WHEN (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%'
      ) = (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      )
      AND (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      ) > 0
      THEN 0.7 + (0.2 * LEAST(
        (SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%')
        ::float /
        GREATEST((SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$'), 1)
      , 1.0))
      WHEN (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%'
      ) >= (
        SELECT count(*) * 0.5 FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      )
      AND (
        SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
        WHERE word ~* '^[a-z0-9]+$'
      ) > 0
      THEN 0.4 + (0.3 * LEAST(
        (SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$' AND lower(${col}) LIKE '%' || word || '%')
        ::float /
        GREATEST((SELECT count(*) FROM unnest(regexp_split_to_array(lower($${paramIndex}), '\\s+')) word
         WHERE word ~* '^[a-z0-9]+$'), 1)
      , 1.0))
      ELSE similarity(${col}, $${paramIndex})
    END
  `;
}

export class PostgresSearchProvider implements SearchProvider {
  async search(q: string, country: Country, limit = 20) {
    const like = `%${q}%`;

    if (country === "BOTH") {
      const perCountry = Math.ceil(limit / 3);
      const rows = await db.$queryRawUnsafe<any[]>(
        `WITH all_results AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY country ORDER BY score DESC) as rn
          FROM (
            SELECT 'CN' country, hs_code_8 "hsCode", description_en "descriptionEn", description_zh "descriptionLocal", chapter,
              mfn_duty_rate::float "dutyRate", vat_rate::float "secondaryRate", requires_licence "requiresLicence",
              ciq_inspection "requiresInspection", is_restricted "isRestricted", is_prohibited "isProhibited",
              NULL::text "importPolicy", NULL::text "inspectionAgency", supervisory_conditions "supervisoryConditions",
              data_source "dataSource", last_updated::text "lastUpdated",
              ${buildScoreSql("description_en", 1)} score
            FROM hs_codes_china
            UNION ALL
            SELECT 'IN', hs_code, description_en, description_hi, chapter, bcd_rate::float, igst_rate::float,
              requires_licence, requires_inspection, is_restricted, is_prohibited, import_policy, inspection_agency,
              NULL, data_source, last_updated::text,
              ${buildScoreSql("description_en", 1)}
            FROM hs_codes_india
            UNION ALL
            SELECT 'AE', hs_code, description_en, description_ar, chapter, customs_duty_rate::float, vat_rate::float,
              FALSE, FALSE, is_restricted, is_prohibited, NULL, NULL, NULL, data_source, last_updated::text,
              ${buildScoreSql("description_en", 1)}
            FROM hs_codes_uae
          ) s
          WHERE score > 0.05 OR "hsCode" LIKE $3
        )
        SELECT * FROM all_results WHERE rn <= $2
        ORDER BY score DESC
        LIMIT $4`,
        q, perCountry, like, limit
      );
      return rows as CodeResult[];
    }

    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM (
        SELECT 'CN' country, hs_code_8 "hsCode", description_en "descriptionEn", description_zh "descriptionLocal", chapter,
          mfn_duty_rate::float "dutyRate", vat_rate::float "secondaryRate", requires_licence "requiresLicence",
          ciq_inspection "requiresInspection", is_restricted "isRestricted", is_prohibited "isProhibited",
          NULL::text "importPolicy", NULL::text "inspectionAgency", supervisory_conditions "supervisoryConditions",
          data_source "dataSource", last_updated::text "lastUpdated",
          ${buildScoreSql("description_en", 1)} score
        FROM hs_codes_china
        UNION ALL
        SELECT 'IN', hs_code, description_en, description_hi, chapter, bcd_rate::float, igst_rate::float,
          requires_licence, requires_inspection, is_restricted, is_prohibited, import_policy, inspection_agency,
          NULL, data_source, last_updated::text,
          ${buildScoreSql("description_en", 1)}
        FROM hs_codes_india
        UNION ALL
        SELECT 'AE', hs_code, description_en, description_ar, chapter, customs_duty_rate::float, vat_rate::float,
          FALSE, FALSE, is_restricted, is_prohibited, NULL, NULL, NULL, data_source, last_updated::text,
          ${buildScoreSql("description_en", 1)}
        FROM hs_codes_uae
      ) s WHERE (country = $2 OR $2 = 'BOTH') AND (score > 0.05 OR "hsCode" LIKE $3)
      ORDER BY score DESC LIMIT $4`,
      q, country, like, limit
    );
    return rows as CodeResult[];
  }
}
