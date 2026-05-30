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
    loadingErpData: "Chargement des données ERP...",
    factoryOptimization: "Optimisation de l'usine",
    optimizationSubtitle: "Lancer le solveur multi-blend pour distribuer les stocks et satisfaire la demande au moindre coût.",
    totalDemandBook: "Demande totale du carnet",
    siloCapacity: "Capacité des silos",
    tons: "tonnes",
    recipesToProduce: "formules à produire",
    availableIngredients: "matières premières disponibles",
    selectRecipesToOptimize: "Sélectionner les formules à optimiser",
    selectedRecipes: "formules sélectionnées",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    noRecipeSelectedHint: "Par défaut, aucune formule n'est sélectionnée. Choisissez les formules à inclure avant de lancer le solveur.",
    runFactoryOptimization: "Lancer l'optimisation de l'usine",
    optimizationRunning: "Optimisation en cours...",
    selectAtLeastOneRecipe: "Sélectionnez au moins une formule",
    readOnlyMode: "Mode lecture seule",
    roleReadOnlyOptimization: "Votre rôle est en lecture seule. Vous pouvez consulter les résultats, mais pas lancer une optimisation.",
    parametricAnalysis: "Analyse paramétrique",
    parametricSubtitle: "Faites varier un nutriment sur une formule cible pour visualiser l'impact sur le coût total.",
    targetRecipe: "Formule cible",
    allSelectedRecipes: "Toutes les formules sélectionnées",
    nutrient: "Nutriment",
    chooseNutrient: "Choisir un nutriment...",
    constraintMode: "Contrainte",
    minConstraint: "Minimum",
    maxConstraint: "Maximum",
    exactConstraint: "Exact",
    rangeStart: "Début",
    rangeEnd: "Fin",
    steps: "Points",
    generateCostCurve: "Générer la courbe de coût",
    calculatingParametric: "Calcul en cours...",
    factoryCostBy: "Coût total usine (TND) en fonction de",
    infeasiblePoints: "Certains points sont infaisables.",
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
    loadingErpData: "Loading ERP data...",
    factoryOptimization: "Factory optimization",
    optimizationSubtitle: "Run the multi-blend solver to allocate inventory and satisfy demand at least cost.",
    totalDemandBook: "Total order demand",
    siloCapacity: "Silo capacity",
    tons: "tons",
    recipesToProduce: "recipes to produce",
    availableIngredients: "available ingredients",
    selectRecipesToOptimize: "Select recipes to optimize",
    selectedRecipes: "selected recipes",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    noRecipeSelectedHint: "By default, no recipe is selected. Choose the recipes to include before running the solver.",
    runFactoryOptimization: "Run factory optimization",
    optimizationRunning: "Optimization running...",
    selectAtLeastOneRecipe: "Select at least one recipe",
    readOnlyMode: "Read-only mode",
    roleReadOnlyOptimization: "Your role is read-only. You can view results, but cannot run an optimization.",
    parametricAnalysis: "Parametric analysis",
    parametricSubtitle: "Vary a nutrient on a target recipe to see the impact on total cost.",
    targetRecipe: "Target recipe",
    allSelectedRecipes: "All selected recipes",
    nutrient: "Nutrient",
    chooseNutrient: "Choose a nutrient...",
    constraintMode: "Constraint",
    minConstraint: "Minimum",
    maxConstraint: "Maximum",
    exactConstraint: "Exact",
    rangeStart: "Start",
    rangeEnd: "End",
    steps: "Points",
    generateCostCurve: "Generate cost curve",
    calculatingParametric: "Calculating...",
    factoryCostBy: "Total factory cost (TND) by",
    infeasiblePoints: "Some points are infeasible.",
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
    loadingErpData: "جار تحميل بيانات ERP...",
    factoryOptimization: "تحسين المصنع",
    optimizationSubtitle: "تشغيل محرك multi-blend لتوزيع المخزون وتلبية الطلب بأقل تكلفة.",
    totalDemandBook: "إجمالي طلبات الإنتاج",
    siloCapacity: "سعة الصوامع",
    tons: "طن",
    recipesToProduce: "تركيبات للإنتاج",
    availableIngredients: "مواد أولية متاحة",
    selectRecipesToOptimize: "اختر التركيبات للتحسين",
    selectedRecipes: "تركيبات محددة",
    selectAll: "تحديد الكل",
    deselectAll: "إلغاء تحديد الكل",
    noRecipeSelectedHint: "افتراضيا لا توجد تركيبة محددة. اختر التركيبات قبل تشغيل المحرك.",
    runFactoryOptimization: "تشغيل تحسين المصنع",
    optimizationRunning: "التحسين قيد التشغيل...",
    selectAtLeastOneRecipe: "اختر تركيبة واحدة على الأقل",
    readOnlyMode: "وضع القراءة فقط",
    roleReadOnlyOptimization: "دورك للقراءة فقط. يمكنك عرض النتائج، لكن لا يمكنك تشغيل التحسين.",
    parametricAnalysis: "تحليل بارامتري",
    parametricSubtitle: "غيّر قيمة غذائية في تركيبة محددة لمشاهدة تأثيرها على التكلفة الإجمالية.",
    targetRecipe: "التركيبة الهدف",
    allSelectedRecipes: "كل التركيبات المحددة",
    nutrient: "القيمة الغذائية",
    chooseNutrient: "اختر قيمة غذائية...",
    constraintMode: "القيد",
    minConstraint: "الحد الأدنى",
    maxConstraint: "الحد الأقصى",
    exactConstraint: "قيمة دقيقة",
    rangeStart: "البداية",
    rangeEnd: "النهاية",
    steps: "النقاط",
    generateCostCurve: "إنشاء منحنى التكلفة",
    calculatingParametric: "جار الحساب...",
    factoryCostBy: "التكلفة الإجمالية للمصنع حسب",
    infeasiblePoints: "بعض النقاط غير قابلة للحل.",
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
