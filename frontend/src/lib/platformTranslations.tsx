"use client";

import { useEffect } from "react";
import { useI18n, type Locale } from "@/lib/i18n";

type TranslationMap = Record<string, Partial<Record<Locale, string>>>;

const translations: TranslationMap = {
  "Bonjour": { en: "Hello", ar: "مرحبا" },
  "Tableau de Bord": { en: "Dashboard", ar: "لوحة التحكم" },
  "Indicateurs Clés": { en: "Key indicators", ar: "المؤشرات الرئيسية" },
  "Raccourcis Rapides": { en: "Quick actions", ar: "اختصارات سريعة" },
  "Matières Premières": { en: "Ingredients", ar: "المواد الأولية" },
  "Formules": { en: "Recipes", ar: "التركيبات" },
  "Optimisation": { en: "Optimization", ar: "التحسين" },
  "Optimisation de l'Usine": { en: "Factory optimization", ar: "تحسين المصنع" },
  "Achats & Stratégie": { en: "Purchasing & strategy", ar: "المشتريات والاستراتيجية" },
  "Achats & stratégie": { en: "Purchasing & strategy", ar: "المشتريات والاستراتيجية" },
  "Tableau de bord du Directeur des Achats — Prix d'Intérêt, négociations et intelligence artificielle.": {
    en: "Purchasing director dashboard — shadow prices, negotiations and artificial intelligence.",
    ar: "لوحة مدير المشتريات — أسعار الاهتمام، التفاوض والذكاء الاصطناعي.",
  },
  "Lancez d'abord une optimisation pour générer les données de Shadow Pricing.": {
    en: "Run an optimization first to generate shadow pricing data.",
    ar: "شغّل التحسين أولا لإنشاء بيانات التسعير الظلي.",
  },
  "Lancer l'Optimisation de l'Usine": {
    en: "Run factory optimization",
    ar: "تشغيل تحسين المصنع",
  },
  "Optimisation en cours…": {
    en: "Optimization running...",
    ar: "جار تشغيل التحسين...",
  },
  "Ingrédients Non Retenus": { en: "Unused ingredients", ar: "المواد غير المختارة" },
  "Plus Proche de Rentabilité": { en: "Closest to profitability", ar: "الأقرب للربحية" },
  "matières avec Prix d'Intérêt": { en: "items with shadow prices", ar: "مواد لها أسعار اهتمام" },
  "Toutes les matières sont utilisées.": { en: "All ingredients are used.", ar: "كل المواد مستخدمة." },
  "Opportunités de Négociation (Shadow Prices)": {
    en: "Negotiation opportunities (shadow prices)",
    ar: "فرص التفاوض (الأسعار الظلية)",
  },
  "Classé par proximité de rentabilité — le premier de la liste est l'effort de négociation le plus faible.": {
    en: "Sorted by proximity to profitability — the first row needs the smallest negotiation effort.",
    ar: "مرتبة حسب القرب من الربحية — أول سطر يحتاج أقل مجهود تفاوض.",
  },
  "Matière Première": { en: "Ingredient", ar: "المادة الأولية" },
  "Formule": { en: "Recipe", ar: "التركيبة" },
  "Coût Actuel (TND/kg)": { en: "Current cost (TND/kg)", ar: "التكلفة الحالية (TND/kg)" },
  "Prix Cible (TND/kg)": { en: "Target price (TND/kg)", ar: "السعر المستهدف (TND/kg)" },
  "Effort Requis": { en: "Required effort", ar: "المجهود المطلوب" },
  "Signal": { en: "Signal", ar: "الإشارة" },
  "Négociable": { en: "Negotiable", ar: "قابل للتفاوض" },
  "Éloigné": { en: "Far", ar: "بعيد" },
  "Toutes les matières premières sont utilisées dans cette optimisation.": {
    en: "All ingredients are used in this optimization.",
    ar: "كل المواد الأولية مستخدمة في هذا التحسين.",
  },
  "Aucun prix d'intérêt à exploiter.": {
    en: "No shadow price to exploit.",
    ar: "لا يوجد سعر اهتمام للاستغلال.",
  },
  "Recommandations Stratégiques de l'IA": {
    en: "AI strategic recommendations",
    ar: "توصيات الذكاء الاصطناعي الاستراتيجية",
  },
  "Analyser avec l'IA Mizan": {
    en: "Analyze with Mizan AI",
    ar: "تحليل بواسطة ذكاء Mizan",
  },
  "Analyse en cours...": { en: "Analysis running...", ar: "جار التحليل..." },
  "Cliquez sur \"Analyser avec l'IA Mizan\" pour générer des recommandations financières ciblées.": {
    en: "Click \"Analyze with Mizan AI\" to generate targeted financial recommendations.",
    ar: "اضغط على \"تحليل بواسطة ذكاء Mizan\" لإنشاء توصيات مالية دقيقة.",
  },
  "L'IA utilisera les données de Shadow Pricing pour identifier les meilleures cibles de négociation.": {
    en: "AI will use shadow pricing data to identify the best negotiation targets.",
    ar: "سيستخدم الذكاء الاصطناعي بيانات التسعير الظلي لتحديد أفضل أهداف التفاوض.",
  },
  "Relancer une Optimisation": {
    en: "Run another optimization",
    ar: "إعادة تشغيل التحسين",
  },
  "Créer une nouvelle formule": { en: "Create a new recipe", ar: "إنشاء تركيبة جديدة" },
  "Mettre à jour les stocks": { en: "Update inventory", ar: "تحديث المخزون" },
  "Lancer la production": { en: "Launch production", ar: "بدء الإنتاج" },
  "Accéder": { en: "Open", ar: "فتح" },
  "Chargement des données ERP…": { en: "Loading ERP data...", ar: "جار تحميل بيانات ERP..." },
  "Matières Premières Actives": { en: "Active ingredients", ar: "المواد النشطة" },
  "Formules Master": { en: "Master recipes", ar: "التركيبات الرئيسية" },
  "Statut du Solveur": { en: "Solver status", ar: "حالة المحرك" },
  "En ligne": { en: "Online", ar: "متصل" },
  "dans l'inventaire": { en: "in inventory", ar: "في المخزون" },
  "en production": { en: "in production", ar: "في الإنتاج" },
  "Recherche": { en: "Search", ar: "بحث" },
  "Tous": { en: "All", ar: "الكل" },
  "Stock Actif": { en: "Active stock", ar: "مخزون نشط" },
  "Base Inactive": { en: "Inactive base", ar: "قاعدة غير نشطة" },
  "Sauvegarder": { en: "Save", ar: "حفظ" },
  "Ajouter": { en: "Add", ar: "إضافة" },
  "Supprimer": { en: "Delete", ar: "حذف" },
  "Annuler": { en: "Cancel", ar: "إلغاء" },
  "Nom": { en: "Name", ar: "الاسم" },
  "Coût": { en: "Cost", ar: "التكلفة" },
  "Transport": { en: "Transport", ar: "النقل" },
  "Stock": { en: "Inventory", ar: "المخزون" },
  "Actif": { en: "Active", ar: "نشط" },
  "Inactif": { en: "Inactive", ar: "غير نشط" },
  "Espèce": { en: "Species", ar: "النوع" },
  "Demande": { en: "Demand", ar: "الطلب" },
  "Rendement": { en: "Yield", ar: "المردود" },
  "Contraintes": { en: "Constraints", ar: "القيود" },
  "Nutriment": { en: "Nutrient", ar: "العنصر الغذائي" },
  "Choisir un nutriment...": { en: "Choose a nutrient...", ar: "اختر عنصرا غذائيا..." },
  "Min": { en: "Min", ar: "الحد الأدنى" },
  "Max": { en: "Max", ar: "الحد الأقصى" },
  "Pas": { en: "Steps", ar: "الخطوات" },
  "Analyse Paramétrique": { en: "Parametric analysis", ar: "تحليل بارامتري" },
  "Générer la Courbe de Coût": { en: "Generate cost curve", ar: "إنشاء منحنى التكلفة" },
  "Certains points sont infaisables.": { en: "Some points are infeasible.", ar: "بعض النقاط غير قابلة للحل." },
  "Calcul en cours…": { en: "Calculating...", ar: "جار الحساب..." },
  "Résultats d'Optimisation": { en: "Optimization results", ar: "نتائج التحسين" },
  "Lancer l'Optimisation": { en: "Run optimization", ar: "تشغيل التحسين" },
  "Audit IA": { en: "AI audit", ar: "تدقيق الذكاء الاصطناعي" },
  "Diagnostic IA": { en: "AI diagnosis", ar: "تشخيص الذكاء الاصطناعي" },
  "Paramétrique": { en: "Parametric", ar: "بارامتري" },
  "Coût Total Usine": { en: "Total factory cost", ar: "التكلفة الإجمالية للمصنع" },
  "Coût (TND)": { en: "Cost (TND)", ar: "التكلفة (TND)" },
  "Infaisable": { en: "Infeasible", ar: "غير قابل للحل" },
  "Atteint": { en: "Achieved", ar: "المحقق" },
  "Cible": { en: "Target", ar: "الهدف" },
  "Cible/Min": { en: "Target/Min", ar: "الهدف/الأدنى" },
  "Précédent": { en: "Previous", ar: "السابق" },
  "Suivant": { en: "Next", ar: "التالي" },
  "Terminer l'onboarding": { en: "Finish onboarding", ar: "إنهاء التهيئة" },
};

const reverseLookup = new Map<string, string>();
for (const [fr, values] of Object.entries(translations)) {
  reverseLookup.set(fr, fr);
  for (const value of Object.values(values)) {
    if (value) reverseLookup.set(value, fr);
  }
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function translateText(text: string, locale: Locale) {
  const normalized = normalize(text);
  const exactSource = reverseLookup.get(normalized);
  if (exactSource) {
    return locale === "fr" ? exactSource : translations[exactSource]?.[locale] ?? text;
  }

  let translated = text;
  const candidates = Array.from(reverseLookup.entries()).sort((a, b) => b[0].length - a[0].length);
  for (const [knownText, source] of candidates) {
    const replacement = locale === "fr" ? source : translations[source]?.[locale];
    if (!replacement || !translated.includes(knownText)) continue;
    translated = translated.split(knownText).join(replacement);
  }
  return translated;
}

function translateElementAttributes(element: Element, locale: Locale) {
  for (const attr of ["placeholder", "title", "aria-label"]) {
    const current = element.getAttribute(attr);
    if (!current) continue;
    const sourceAttr = `data-i18n-source-${attr}`;
    const source = element.getAttribute(sourceAttr) || reverseLookup.get(normalize(current)) || normalize(current);
    element.setAttribute(sourceAttr, source);
    const translated = locale === "fr" ? source : translations[source]?.[locale];
    if (translated) element.setAttribute(attr, translated);
  }
}

function walk(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    const trimmed = normalize(raw);
    if (!trimmed) return;
    const translated = translateText(trimmed, locale);
    if (translated === trimmed) return;
    const leading = raw.match(/^\s*/)?.[0] ?? "";
    const trailing = raw.match(/\s*$/)?.[0] ?? "";
    node.textContent = `${leading}${translated}${trailing}`;
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(element.tagName)) {
    translateElementAttributes(element, locale);
    return;
  }

  translateElementAttributes(element, locale);
  if (locale === "ar") {
    element.setAttribute("dir", "auto");
  } else if (element.getAttribute("dir") === "auto") {
    element.removeAttribute("dir");
  }
  node.childNodes.forEach((child) => walk(child, locale));
}

export default function PlatformTranslator() {
  const { locale } = useI18n();

  useEffect(() => {
    const apply = () => walk(document.body, locale);
    apply();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(apply);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
