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
    dashboardGreeting: "Bonjour",
    dashboardFallbackName: "Directeur",
    dashboardSubtitle: "Voici l'état opérationnel de votre usine aujourd'hui.",
    keyIndicators: "Indicateurs clés",
    quickActions: "Raccourcis rapides",
    activeIngredientsKpi: "Matières premières actives",
    masterRecipesKpi: "Formules master",
    solverStatusKpi: "Statut du solveur",
    inInventory: "dans l'inventaire",
    inProduction: "en production",
    online: "En ligne",
    solverOnline: "GLOP actif",
    createRecipeAction: "Créer une nouvelle formule",
    createRecipeDesc: "Définir tonnage, rendement et cibles nutritionnelles",
    updateStockAction: "Mettre à jour les stocks",
    updateStockDesc: "Éditer les coûts et valeurs nutritives des matières premières",
    launchProductionAction: "Lancer la production",
    launchProductionDesc: "Optimiser le mix multi-formule et générer les bons de commande",
    open: "Accéder",
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
    dashboardGreeting: "Hello",
    dashboardFallbackName: "Director",
    dashboardSubtitle: "Here is your factory's operational state today.",
    keyIndicators: "Key indicators",
    quickActions: "Quick actions",
    activeIngredientsKpi: "Active ingredients",
    masterRecipesKpi: "Master recipes",
    solverStatusKpi: "Solver status",
    inInventory: "in inventory",
    inProduction: "in production",
    online: "Online",
    solverOnline: "GLOP active",
    createRecipeAction: "Create a new recipe",
    createRecipeDesc: "Define tonnage, yield and nutritional targets",
    updateStockAction: "Update inventory",
    updateStockDesc: "Edit costs and nutritional values for ingredients",
    launchProductionAction: "Launch production",
    launchProductionDesc: "Optimize the multi-recipe mix and generate purchase orders",
    open: "Open",
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
    dashboardGreeting: "مرحبا",
    dashboardFallbackName: "المدير",
    dashboardSubtitle: "هذه هي الحالة التشغيلية لمصنعك اليوم.",
    keyIndicators: "المؤشرات الرئيسية",
    quickActions: "إجراءات سريعة",
    activeIngredientsKpi: "المواد الأولية النشطة",
    masterRecipesKpi: "التركيبات الرئيسية",
    solverStatusKpi: "حالة المحرك",
    inInventory: "في المخزون",
    inProduction: "في الإنتاج",
    online: "متصل",
    solverOnline: "GLOP نشط",
    createRecipeAction: "إنشاء تركيبة جديدة",
    createRecipeDesc: "تحديد الكمية والمردود والأهداف الغذائية",
    updateStockAction: "تحديث المخزون",
    updateStockDesc: "تعديل التكاليف والقيم الغذائية للمواد الأولية",
    launchProductionAction: "إطلاق الإنتاج",
    launchProductionDesc: "تحسين مزيج التركيبات وإنشاء أوامر الشراء",
    open: "فتح",
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
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.locale = nextLocale;
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.locale = locale;
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
