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
    "home.subtitle": "Free HS code search and trade comparison for China, India and UAE",
    "home.search.placeholder": "Search by HS code or product name...",
    "home.search.btn": "Search",
    "home.feature.search.title": "Search HS Codes",
    "home.feature.search.desc": "Look up any HS code across China, India and UAE tariff databases",
    "home.feature.classify.title": "AI Classification",
    "home.feature.classify.desc": "Describe a product in any language and get matched HS codes",
    "home.feature.compare.title": "Bilateral Compare",
    "home.feature.compare.desc": "Compare duties and regulations between China, India and UAE",
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
    "search.hero.title": "Search across 35,000+ HS codes",
    "search.hero.desc": "Supports codes from China, India and UAE",

    // Classify
    "classify.title": "Describe a product, get HS codes",
    "classify.subtitle": "Type a product description and we'll match it against 35,000+ HS codes across China, India and UAE.",
    "classify.badge.smart": "Smart keyword search",
    "classify.badge.count": "35,000+ HS codes",
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
    "classify.prompt.desc": "We'll match it against all 35,000+ HS codes in all databases",
    "classify.sample.electric": "electric control panels",
    "classify.sample.herbal": "packaged herbal tea",
    "classify.sample.lithium": "lithium battery pack",
    "classify.sample.plastic": "plastic kitchen container",

    // Compare
    "compare.label": "Compare",
    "compare.title": "China, India and UAE, side by side.",
    "compare.subtitle": "Type one code, compare across countries in a single view.",
    "compare.placeholder": "Enter HS code",
    "compare.btn": "Compare",
    "compare.empty.title": "Enter an HS code to compare across countries.",
    "compare.empty.desc": "Supports codes from China, India and UAE.",
    "compare.cn.customs": "China customs / 中国海关",
    "compare.in.customs": "India customs / 印度海关",
    "compare.ae.customs": "UAE customs / 阿联酋海关",
    "compare.mfn": "MFN duty",
    "compare.bcd": "BCD",
    "compare.vat": "VAT",
    "compare.igst": "IGST",
    "compare.supervisory.yes": "Supervisory conditions: {v}",
    "compare.supervisory.no": "No supervisory conditions recorded",
    "compare.policy.yes": "Import policy: {v}",
    "compare.policy.no": "No import policy recorded",
    "compare.confidence": "Match confidence",
    "compare.closest.label": "Approximate Match",
    "compare.closest.confidence": "Match confidence",
    "compare.closest.high": "Good match",
    "compare.closest.medium": "Partial match",
    "compare.closest.low": "Weak match",
    "compare.closest.disclaimer": "This is an approximate match based on the same HS chapter and similar product description. The duty rates shown may not apply to the exact product you searched for. Always verify with official customs authorities.",
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
    "popup.ae.customs": "UAE CUSTOMS / 阿联酋海关",
    "popup.mfn": "MFN duty",
    "popup.bcd": "BCD",
    "popup.vat": "Import VAT / 增值税",
    "popup.sws": "SWS (10% of BCD)",
    "popup.customs.duty": "Customs Duty",
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
    "popup.no.uae": "No UAE record for this code.",
    "popup.calculator": "Duty Calculator",
    "popup.cif": "CIF (USD)",
    "popup.reset": "Reset",
    "popup.india.breakdown": "India duty breakdown",
    "popup.uae.breakdown": "UAE duty breakdown",
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
    "db.desc": "Browse all HS codes. Filter, sort, and search across the full catalog.",
    "db.rows": "codes",
    "db.chapters": "chapters",
    "db.high.duty": "high-duty",
    "db.flagged": "flagged",
    "db.search.placeholder": "Search by HS code or description...",
    "db.chapter.filter": "Chapter",
    "db.chapter.clear": "All",
    "db.results": "{n} codes",
    "db.empty.title": "No results found",
    "db.empty.desc": "Try adjusting your search or chapter filter.",
    "db.restricted": "Restricted",
    "db.prohibited": "Prohibited",
    "db.view.details": "View details",
    "db.duty": "Duty",
    "db.scd": "SCD",
    "db.page": "Page {n} of {m}",
    "db.prev": "Previous",
    "db.next": "Next",
    "db.sort.hs": "HS Code",
    "db.sort.duty": "Duty Rate",
    "db.sort.desc": "Description",
    "db.per.page": "{n} per page",

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
    "common.uae": "UAE",
  },
  zh: {
    // Header
    "nav.search": "搜索",
    "nav.classify": "分类",
    "nav.compare": "比较",
    "nav.database": "数据库",

    // Home
    "home.hero": "查找 · 比较 · 分类",
    "home.subtitle": "免费的中国-印度-阿联酋HS编码查询与贸易对比工具",
    "home.search.placeholder": "输入HS编码或产品名称搜索...",
    "home.search.btn": "搜索",
    "home.feature.search.title": "搜索HS编码",
    "home.feature.search.desc": "查询中国、印度和阿联酋关税数据库中的任何HS编码",
    "home.feature.classify.title": "AI智能分类",
    "home.feature.classify.desc": "用任何语言描述产品，自动匹配HS编码",
    "home.feature.compare.title": "多国对比",
    "home.feature.compare.desc": "对比中国、印度和阿联酋之间的关税与法规",
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
    "search.hero.title": "搜索超过 35,000 条HS编码",
    "search.hero.desc": "支持中国、印度和阿联酋的编码数据",

    // Classify
    "classify.title": "描述产品，获取HS编码",
    "classify.subtitle": "输入产品描述，我们将从中国、印度和阿联酋超过35,000条HS编码中为您匹配。",
    "classify.badge.smart": "智能关键词搜索",
    "classify.badge.count": "35,000+ HS编码",
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
    "classify.prompt.desc": "我们将从三个数据库中超过35,000条HS编码中为您匹配",
    "classify.sample.electric": "电气控制面板",
    "classify.sample.herbal": "袋装花草茶",
    "classify.sample.lithium": "锂电池组",
    "classify.sample.plastic": "塑料厨房容器",

    // Compare
    "compare.label": "比较",
    "compare.title": "中国、印度与阿联酋，并排对比。",
    "compare.subtitle": "输入一个编码，一次性查看各国对比。",
    "compare.placeholder": "输入HS编码",
    "compare.btn": "比较",
    "compare.empty.title": "输入HS编码以对比各国数据。",
    "compare.empty.desc": "支持中国、印度和阿联酋的编码。",
    "compare.cn.customs": "中国海关 / China customs",
    "compare.in.customs": "印度海关 / India customs",
    "compare.ae.customs": "阿联酋海关 / UAE customs",
    "compare.mfn": "MFN关税",
    "compare.bcd": "BCD",
    "compare.vat": "增值税",
    "compare.igst": "IGST",
    "compare.supervisory.yes": "监管条件：{v}",
    "compare.supervisory.no": "无监管条件记录",
    "compare.policy.yes": "进口政策：{v}",
    "compare.policy.no": "无进口政策记录",
    "compare.confidence": "匹配置信度",
    "compare.closest.label": "近似匹配",
    "compare.closest.confidence": "匹配置信度",
    "compare.closest.high": "匹配良好",
    "compare.closest.medium": "部分匹配",
    "compare.closest.low": "匹配较弱",
    "compare.closest.disclaimer": "此为基于相同HS章节和相似产品描述的近似匹配。所示关税税率可能不适用于您搜索的确切产品。请在做出贸易决策前向海关主管部门确认。",
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
    "popup.ae.customs": "阿联酋海关 / UAE CUSTOMS",
    "popup.mfn": "MFN关税",
    "popup.bcd": "BCD（基本关税）",
    "popup.vat": "进口增值税 / VAT",
    "popup.sws": "社会福利附加费 (BCD的10%)",
    "popup.customs.duty": "关税",
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
    "popup.no.uae": "该编码无阿联酋海关记录。",
    "popup.calculator": "关税计算器",
    "popup.cif": "CIF价格（美元）",
    "popup.reset": "重置",
    "popup.india.breakdown": "印度关税明细",
    "popup.uae.breakdown": "阿联酋关税明细",
    "popup.landed.cost": "到岸成本",
    "popup.total": "综合税负",
    "popup.fx": "参考汇率：1 USD = {rate} {currency}，生效日期 {date}",
    "popup.duty.note": "关税计算将在数据可用后显示。",
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
    "db.desc": "浏览所有HS编码。筛选、排序、搜索完整目录。",
    "db.rows": "条编码",
    "db.chapters": "个章节",
    "db.high.duty": "高关税",
    "db.flagged": "已标记",
    "db.search.placeholder": "按HS编码或描述搜索...",
    "db.chapter.filter": "章节",
    "db.chapter.clear": "全部",
    "db.results": "{n} 条编码",
    "db.empty.title": "未找到结果",
    "db.empty.desc": "请调整搜索条件或章节筛选。",
    "db.restricted": "受限",
    "db.prohibited": "禁止",
    "db.view.details": "查看详情",
    "db.duty": "关税",
    "db.scd": "附加税",
    "db.page": "第 {n} 页，共 {m} 页",
    "db.prev": "上一页",
    "db.next": "下一页",
    "db.sort.hs": "HS编码",
    "db.sort.duty": "关税税率",
    "db.sort.desc": "描述",
    "db.per.page": "每页 {n} 条",

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
    "common.uae": "阿联酋",
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
