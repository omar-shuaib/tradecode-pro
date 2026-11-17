"use client";

import { useTranslation } from "../lib/i18n";

/**
 * Warning shown above a duty breakdown when the API had no published rate for
 * one or more duty components and therefore calculated them at 0%.
 */
export function RatesMissingNote({ missing }: { missing?: string[] | null }) {
  const { t } = useTranslation();
  if (!missing?.length) return null;
  return (
    <p
      role="note"
      style={{
        margin: "0 0 12px",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid var(--warning)",
        color: "var(--text)",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {t("duty.ratesMissing", { rates: missing.join(" + ") })}
    </p>
  );
}
