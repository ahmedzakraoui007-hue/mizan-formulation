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
  if (locale === "fr") return reverseLookup.get(normalize(text)) ?? text;
  const normalized = normalize(text);
  const source = reverseLookup.get(normalized) ?? normalized;
  return translations[source]?.[locale] ?? text;
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
    if (!trimmed || !reverseLookup.has(trimmed)) return;
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
