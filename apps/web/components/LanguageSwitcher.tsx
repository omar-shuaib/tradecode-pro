"use client";

import { useTranslation, type Locale } from "../lib/i18n";
import { Globe } from "lucide-react";

const options: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
  { value: "hi", label: "HI" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 4px",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <Globe style={{ width: 14, height: 14, color: "var(--text-muted)", marginLeft: 4 }} />
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          style={{
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: "calc(var(--radius-sm) - 2px)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
            backgroundColor: locale === opt.value ? "var(--accent)" : "transparent",
            color: locale === opt.value ? "var(--accent-text, #fff)" : "var(--text-secondary)",
            lineHeight: 1,
          }}
          aria-label={`Switch to ${opt.value === "en" ? "English" : "中文"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
