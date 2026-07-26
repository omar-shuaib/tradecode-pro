"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Locale = "en" | "zh";

const translations = {
  en: {
    // Header
    "nav.search": "Search",
    "nav.classify": "Classify",
    "nav.compare": "Compare",
    "nav.database": "Database",

    // Home
    "home.hero": "Find. Compare. Classify.",
    "home.subtitle": "Free HS code search and bilateral trade comparison for China and India",
    "home.search.placeholder": "Search by HS code or product name...",
    "home.search.btn": "Search",
    "home.feature.search.title": "Search HS Codes",
    "home.feature.search.desc": "Look up any HS code across China and India tariff databases",
    "home.feature.classify.title": "AI Classification",
    "home.feature.classify.desc": "Describe a product in any language and get matched HS codes",
    "home.feature.compare.title": "Bilateral Compare",
    "home.feature.compare.desc": "Compare duties and regulations between China and India",
    "home.stat.codes": "HS codes",
    "home.stat.countries": "countries",
    "home.stat.free": "Free & open",

    // Search
    "search.title": "Search HS Codes",
    "search.subtitle": "Start typing a code or product name. Pick a suggestion to open the full bilateral view.",
    "search.placeholder": "Search HS code or product name...",
    "search.btn": "Search",
    "search.loading": "Searching...",
    "search.results": "{n} result(s)",
    "search.enter": "Enter a query to search",
    "search.empty.title": "No results found",
    "search.empty.desc": "Try a different HS code or product name",
    "search.hero.title": "Search across 25,000+ HS codes",
    "search.hero.desc": "Supports codes from both China and India",

    // Classify
    "classify.title": "Describe a product, get HS codes",
    "classify.subtitle": "Type a product description and we'll match it against 25,000+ HS codes across China and India.",
    "classify.badge.smart": "Smart keyword search",
    "classify.badge.count": "25,000+ HS codes",
    "classify.placeholder": "Describe your product in any language...",
    "classify.loading": "Classifying...",
    "classify.btn": "Classify",
    "classify.result.title": "Suggested codes",
    "classify.result.fallback": "Ranked by keyword relevance across all HS codes",
    "classify.result.direct": "Results from database search",
    "classify.result.matches": "{n} match(es)",
    "classify.result.high": "Duty high",
    "classify.result.normal": "Duty normal",
    "classify.result.compliance": "Compliance note",
    "classify.result.clear": "Clear",
    "classify.empty.title": "No strong match returned for this description.",
    "classify.empty.desc": "Try a more specific product name or HS code.",
    "classify.prompt.title": "Enter a product description above",
    "classify.prompt.desc": "We'll match it against all 25,000+ HS codes in both databases",
    "classify.sample.electric": "electric control panels",
    "classify.sample.herbal": "packaged herbal tea",
    "classify.sample.lithium": "lithium battery pack",
    "classify.sample.plastic": "plastic kitchen container",

    // Compare
    "compare.label": "Compare",
    "compare.title": "China and India, side by side.",
    "compare.subtitle": "Type one code, compare both sides in a single view.",
    "compare.placeholder": "Enter HS code",
    "compare.btn": "Compare",
    "compare.empty.title": "Enter an HS code to compare both countries.",
    "compare.empty.desc": "Supports codes from both China and India.",
    "compare.cn.customs": "China customs / 中国海关",
    "compare.in.customs": "India customs / 印度海关",
    "compare.mfn": "MFN duty",
    "compare.bcd": "BCD",
    "compare.vat": "VAT",
    "compare.igst": "IGST",
    "compare.supervisory.yes": "Supervisory conditions: {v}",
    "compare.supervisory.no": "No supervisory conditions recorded",
    "compare.policy.yes": "Import policy: {v}",
    "compare.policy.no": "No import policy recorded",
    "compare.confidence": "Match confidence",
    "compare.no.data": "No data available",
    "compare.no.flags": "No flags",
    "compare.high.mfn": "High MFN",
    "compare.normal.mfn": "MFN normal",
    "compare.high.bcd": "High BCD",
    "compare.normal.bcd": "BCD normal",
    "compare.licence": "Licence",
    "compare.inspection": "Inspection",
    "compare.restricted": "Restricted",
    "compare.prohibited": "Prohibited",

    // CodePopup
    "popup.cn.customs": "CHINA CUSTOMS / 中国海关",
    "popup.in.customs": "INDIA CUSTOMS / 印度海关",
    "popup.mfn": "MFN duty",
    "popup.bcd": "BCD",
    "popup.vat": "Import VAT / 增值税",
    "popup.sws": "SWS (10% of BCD)",
    "popup.total.incidence": "Total incidence / 综合税负 ~{v}%",
    "popup.prohibited": "Prohibited",
    "popup.restricted": "Restricted",
    "popup.licence": "Licence required",
    "popup.inspection": "Inspection",
    "popup.policy": "Policy",
    "popup.supervisory": "Supervisory",
    "popup.high.mfn": "High MFN",
    "popup.high.vat": "High VAT",
    "popup.high.bcd": "High BCD",
    "popup.high.igst": "High IGST",
    "popup.no.flags": "No special flags",
    "popup.no.china": "No China record for this code.",
    "popup.no.india": "No India record for this code.",
    "popup.calculator": "Duty Calculator",
    "popup.cif": "CIF (USD)",
    "popup.reset": "Reset",
    "popup.india.breakdown": "India duty breakdown",
    "popup.landed.cost": "Landed cost",
    "popup.total": "Total incidence",
    "popup.fx": "Reference FX: 1 USD = {rate} {currency}, effective {date}",
    "popup.duty.note": "Duty calculation will appear once the India side is available.",
    "popup.close": "Close",

    // Compliance
    "compliance.title": "Compliance",
    "compliance.prohibited": "Prohibited",
    "compliance.restricted": "Restricted",
    "compliance.licence": "Licence required",
    "compliance.inspection": "Inspection required",
    "compliance.policy": "Import policy",
    "compliance.supervisory": "Supervisory",
    "compliance.clear": "All clear",

    // Database
    "db.label": "Database",
    "db.explorer": "{country} Explorer",
    "db.desc": "Browse loaded HS codes, filter by chapter, and inspect duty details.",
    "db.rows": "rows",
    "db.chapters": "chapters",
    "db.high.duty": "high-duty",
    "db.flagged": "flagged",
    "db.search.placeholder": "Search by HS code or description...",
    "db.chapter.filter": "Chapter filter",
    "db.chapter.clear": "Clear",
    "db.results": "{n} results",
    "db.empty.title": "No results found",
    "db.empty.desc": "Try adjusting your search or chapter filter.",
    "db.restricted": "Restricted",
    "db.prohibited": "Prohibited",
    "db.view.details": "View details",
    "db.duty": "Duty",
    "db.scd": "SCD",

    // DutyDisclaimer
    "disclaimer": "Duty rates and import policies shown are for reference only. Actual rates may vary based on the specific sub-heading, origin, trade agreements, and applicable exemptions. Always verify with official customs authorities before making trade decisions.",

    // Common
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.na": "n/a",
    "common.yes": "Yes",
    "common.no": "No",
    "common.china": "China",
    "common.india": "India",
  },
  zh: {
    // Header
    "nav.search": "搜索",
    "nav.classify": "分类",
    "nav.compare": "比较",
    "nav.database": "数据库",

    // Home
    "home.hero": "查找 · 比较 · 分类",
    "home.subtitle": "免费的中国-印度HS编码查询与双边贸易对比工具",
    "home.search.placeholder": "输入HS编码或产品名称搜索...",
    "home.search.btn": "搜索",
    "home.feature.search.title": "搜索HS编码",
    "home.feature.search.desc": "查询中国和印度关税数据库中的任何HS编码",
    "home.feature.classify.title": "AI智能分类",
    "home.feature.classify.desc": "用任何语言描述产品，自动匹配HS编码",
    "home.feature.compare.title": "双边对比",
    "home.feature.compare.desc": "对比中国和印度之间的关税与法规",
    "home.stat.codes": "HS编码",
    "home.stat.countries": "个国家",
    "home.stat.free": "免费开放",

    // Search
    "search.title": "搜索HS编码",
    "search.subtitle": "输入编码或产品名称，选择建议项查看完整的双边对比视图。",
    "search.placeholder": "搜索HS编码或产品名称...",
    "search.btn": "搜索",
    "search.loading": "搜索中...",
    "search.results": "{n} 条结果",
    "search.enter": "输入查询内容进行搜索",
    "search.empty.title": "未找到结果",
    "search.empty.desc": "请尝试其他HS编码或产品名称",
    "search.hero.title": "搜索超过 25,000 条HS编码",
    "search.hero.desc": "支持中国和印度的编码数据",

    // Classify
    "classify.title": "描述产品，获取HS编码",
    "classify.subtitle": "输入产品描述，我们将从中国和印度超过25,000条HS编码中为您匹配。",
    "classify.badge.smart": "智能关键词搜索",
    "classify.badge.count": "25,000+ HS编码",
    "classify.placeholder": "用任何语言描述您的产品...",
    "classify.loading": "分类中...",
    "classify.btn": "分类",
    "classify.result.title": "推荐编码",
    "classify.result.fallback": "按关键词相关性排名",
    "classify.result.direct": "数据库搜索结果",
    "classify.result.matches": "{n} 个匹配",
    "classify.result.high": "高关税",
    "classify.result.normal": "正常关税",
    "classify.result.compliance": "合规提示",
    "classify.result.clear": "无问题",
    "classify.empty.title": "未找到强匹配结果。",
    "classify.empty.desc": "请尝试更具体的产品名称或HS编码。",
    "classify.prompt.title": "请在上方输入产品描述",
    "classify.prompt.desc": "我们将从两个数据库中超过25,000条HS编码中为您匹配",
    "classify.sample.electric": "电气控制面板",
    "classify.sample.herbal": "袋装花草茶",
    "classify.sample.lithium": "锂电池组",
    "classify.sample.plastic": "塑料厨房容器",

    // Compare
    "compare.label": "比较",
    "compare.title": "中国与印度，并排对比。",
    "compare.subtitle": "输入一个编码，一次性查看双方对比。",
    "compare.placeholder": "输入HS编码",
    "compare.btn": "比较",
    "compare.empty.title": "输入HS编码以对比两国数据。",
    "compare.empty.desc": "支持中国和印度的编码。",
    "compare.cn.customs": "中国海关 / China customs",
    "compare.in.customs": "印度海关 / India customs",
    "compare.mfn": "MFN关税",
    "compare.bcd": "BCD",
    "compare.vat": "增值税",
    "compare.igst": "IGST",
    "compare.supervisory.yes": "监管条件：{v}",
    "compare.supervisory.no": "无监管条件记录",
    "compare.policy.yes": "进口政策：{v}",
    "compare.policy.no": "无进口政策记录",
    "compare.confidence": "匹配置信度",
    "compare.no.data": "暂无数据",
    "compare.no.flags": "无标记",
    "compare.high.mfn": "高MFN关税",
    "compare.normal.mfn": "MFN正常",
    "compare.high.bcd": "高BCD",
    "compare.normal.bcd": "BCD正常",
    "compare.licence": "需要许可",
    "compare.inspection": "需要检验",
    "compare.restricted": "受限",
    "compare.prohibited": "禁止",

    // CodePopup
    "popup.cn.customs": "中国海关 / CHINA CUSTOMS",
    "popup.in.customs": "印度海关 / INDIA CUSTOMS",
    "popup.mfn": "MFN关税",
    "popup.bcd": "BCD（基本关税）",
    "popup.vat": "进口增值税 / VAT",
    "popup.sws": "社会福利附加费 (BCD的10%)",
    "popup.total.incidence": "综合税负 / Total incidence ~{v}%",
    "popup.prohibited": "禁止",
    "popup.restricted": "受限",
    "popup.licence": "需要许可证",
    "popup.inspection": "检验",
    "popup.policy": "政策",
    "popup.supervisory": "监管",
    "popup.high.mfn": "高MFN关税",
    "popup.high.vat": "高增值税",
    "popup.high.bcd": "高BCD",
    "popup.high.igst": "高IGST",
    "popup.no.flags": "无特殊标记",
    "popup.no.china": "该编码无中国海关记录。",
    "popup.no.india": "该编码无印度海关记录。",
    "popup.calculator": "关税计算器",
    "popup.cif": "CIF价格（美元）",
    "popup.reset": "重置",
    "popup.india.breakdown": "印度关税明细",
    "popup.landed.cost": "到岸成本",
    "popup.total": "综合税负",
    "popup.fx": "参考汇率：1 USD = {rate} {currency}，生效日期 {date}",
    "popup.duty.note": "印度关税计算将在印度数据可用后显示。",
    "popup.close": "关闭",

    // Compliance
    "compliance.title": "合规性",
    "compliance.prohibited": "禁止",
    "compliance.restricted": "受限",
    "compliance.licence": "需要许可证",
    "compliance.inspection": "需要检验",
    "compliance.policy": "进口政策",
    "compliance.supervisory": "监管条件",
    "compliance.clear": "无问题",

    // Database
    "db.label": "数据库",
    "db.explorer": "{country} 数据浏览器",
    "db.desc": "浏览已加载的HS编码，按章节筛选，查看关税详情。",
    "db.rows": "条记录",
    "db.chapters": "个章节",
    "db.high.duty": "高关税",
    "db.flagged": "已标记",
    "db.search.placeholder": "按HS编码或描述搜索...",
    "db.chapter.filter": "章节筛选",
    "db.chapter.clear": "清除",
    "db.results": "{n} 条结果",
    "db.empty.title": "未找到结果",
    "db.empty.desc": "请调整搜索条件或章节筛选。",
    "db.restricted": "受限",
    "db.prohibited": "禁止",
    "db.view.details": "查看详情",
    "db.duty": "关税",
    "db.scd": "附加税",

    // DutyDisclaimer
    "disclaimer": "所示关税税率和进口政策仅供参考。实际税率可能因具体子税号、产地、贸易协定和适用豁免而有所不同。请在做出贸易决策前向海关主管部门确认。",

    // Common
    "common.close": "关闭",
    "common.loading": "加载中...",
    "common.na": "无",
    "common.yes": "是",
    "common.no": "否",
    "common.china": "中国",
    "common.india": "印度",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("tradecode-lang") as Locale) ?? "en";
    setLocaleState(saved);
    document.documentElement.lang = saved;
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("tradecode-lang", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text: string = translations[locale]?.[key] ?? translations.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [locale]
  );

  if (!mounted) {
    const tEn = (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text: string = translations.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    };
    return (
      <I18nContext.Provider value={{ locale: "en", setLocale, t: tEn }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
