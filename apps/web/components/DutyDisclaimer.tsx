"use client";

import { useTranslation } from "../lib/i18n";

export function DutyDisclaimer() {
  const { t } = useTranslation();
  return <p className="disclaimer">{t("disclaimer")}</p>;
}
