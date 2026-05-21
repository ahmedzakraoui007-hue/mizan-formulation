"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "fr" | "en" | "ar";

const dictionaries = {
  fr: {
    dashboard: "Tableau de bord",
    ingredients: "Matières premières",
    recipes: "Formules",
    optimization: "Optimisation",
    purchasing: "Achats & stratégie",
    onboarding: "Onboarding",
    workspace: "Espace de travail",
    language: "Langue",
    signOut: "Compte",
    welcomeTitle: "Configurez votre espace Mizan",
    welcomeSubtitle: "Choisissez votre langue, nommez votre entreprise et lancez le tutoriel de formulation.",
    companyName: "Nom de l'entreprise",
    startTutorial: "Démarrer le tutoriel",
    completeOnboarding: "Terminer l'onboarding",
    next: "Suivant",
    previous: "Précédent",
    stepTenant: "Votre espace est isolé",
    stepTenantText: "Chaque utilisateur ou organisation Clerk possède ses propres ingrédients, formules et résultats.",
    stepData: "Données de départ prêtes",
    stepDataText: "Mizan copie une base INRAE de démarrage dans votre tenant, puis vos modifications restent privées.",
    stepSolver: "Solveur multi-blend",
    stepSolverText: "Activez les ingrédients, fixez les contraintes, puis laissez le solveur répartir les stocks au moindre coût.",
  },
  en: {
    dashboard: "Dashboard",
    ingredients: "Ingredients",
    recipes: "Recipes",
    optimization: "Optimization",
    purchasing: "Purchasing & strategy",
    onboarding: "Onboarding",
    workspace: "Workspace",
    language: "Language",
    signOut: "Account",
    welcomeTitle: "Set up your Mizan workspace",
    welcomeSubtitle: "Pick a language, name your company, and start the formulation tutorial.",
    companyName: "Company name",
    startTutorial: "Start tutorial",
    completeOnboarding: "Finish onboarding",
    next: "Next",
    previous: "Previous",
    stepTenant: "Your workspace is isolated",
    stepTenantText: "Each Clerk user or organization gets separate ingredients, recipes, and results.",
    stepData: "Starter data is ready",
    stepDataText: "Mizan copies an INRAE starter catalog into your tenant, then your edits stay private.",
    stepSolver: "Multi-blend solver",
    stepSolverText: "Activate ingredients, define constraints, then let the solver allocate stock at least cost.",
  },
  ar: {
    dashboard: "لوحة التحكم",
    ingredients: "المواد الأولية",
    recipes: "التركيبات",
    optimization: "التحسين",
    purchasing: "المشتريات والاستراتيجية",
    onboarding: "التهيئة",
    workspace: "مساحة العمل",
    language: "اللغة",
    signOut: "الحساب",
    welcomeTitle: "قم بإعداد مساحة Mizan",
    welcomeSubtitle: "اختر اللغة، واسم الشركة، ثم ابدأ دليل التركيب.",
    companyName: "اسم الشركة",
    startTutorial: "بدء الدليل",
    completeOnboarding: "إنهاء التهيئة",
    next: "التالي",
    previous: "السابق",
    stepTenant: "مساحتك معزولة",
    stepTenantText: "كل مستخدم أو منظمة في Clerk لديها مواد وتركيبات ونتائج منفصلة.",
    stepData: "بيانات البداية جاهزة",
    stepDataText: "ينسخ Mizan كتالوج INRAE كبداية داخل tenant الخاص بك، ثم تبقى تعديلاتك خاصة.",
    stepSolver: "محرك multi-blend",
    stepSolverText: "فعّل المواد، حدد القيود، ثم اترك المحرك يوزع المخزون بأقل تكلفة.",
  },
} satisfies Record<Locale, Record<string, string>>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof dictionaries.fr) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "fr";
    const saved = window.localStorage.getItem("mizan-locale") as Locale | null;
    return saved && saved in dictionaries ? saved : "fr";
  });

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem("mizan-locale", nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const syncLocale = () => {
      const saved = window.localStorage.getItem("mizan-locale") as Locale | null;
      if (saved && saved in dictionaries) setLocaleState(saved);
    };
    window.addEventListener("mizan-locale-change", syncLocale);
    window.addEventListener("storage", syncLocale);
    return () => {
      window.removeEventListener("mizan-locale-change", syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => dictionaries[locale][key] ?? dictionaries.fr[key] ?? key,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
