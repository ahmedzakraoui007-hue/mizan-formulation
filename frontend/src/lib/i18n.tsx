"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "fr" | "en" | "ar";
type Direction = "ltr" | "rtl";

export const localeOptions: { value: Locale; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

export function getLocaleDirection(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

const dictionaries = {
  fr: {
    dashboard: "Tableau de bord",
    ingredients: "Matières premières",
    recipes: "Formules",
    optimization: "Optimisation",
    purchasing: "Achats & stratégie",
    onboarding: "Configuration initiale",
    admin: "Administration",
    workspace: "Espace de travail",
    language: "Langue",
    signOut: "Compte",
    welcomeTitle: "Configurez votre espace Mizan",
    welcomeSubtitle: "Choisissez la langue de travail, nommez votre entreprise et préparez votre environnement de formulation.",
    companyName: "Nom de l'entreprise",
    startTutorial: "Démarrer le tutoriel",
    completeOnboarding: "Terminer l'onboarding",
    next: "Suivant",
    previous: "Précédent",
    stepTenant: "Votre espace est isolé",
    stepTenantText: "Chaque utilisateur ou organisation Clerk possède ses propres ingrédients, formules et résultats.",
    stepData: "Données de départ prêtes",
    stepDataText: "Mizan initialise un catalogue INRAE de référence dans votre espace, puis conserve vos modifications séparément.",
    stepSolver: "Solveur multi-blend",
    stepSolverText: "Activez les matières premières, définissez les contraintes, puis laissez le solveur répartir les stocks au meilleur coût.",
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
    onboarding: "Initial setup",
    admin: "Administration",
    workspace: "Workspace",
    language: "Language",
    signOut: "Account",
    welcomeTitle: "Set up your Mizan workspace",
    welcomeSubtitle: "Choose your working language, name your company, and prepare your formulation workspace.",
    companyName: "Company name",
    startTutorial: "Start tutorial",
    completeOnboarding: "Finish onboarding",
    next: "Next",
    previous: "Previous",
    stepTenant: "Your workspace is isolated",
    stepTenantText: "Each Clerk user or organization gets separate ingredients, recipes, and results.",
    stepData: "Starter data is ready",
    stepDataText: "Mizan initializes a reference INRAE catalog in your workspace while keeping your edits isolated.",
    stepSolver: "Multi-blend solver",
    stepSolverText: "Activate raw materials, define constraints, then let the solver allocate inventory at the best cost.",
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
    onboarding: "الإعداد الأولي",
    admin: "الإدارة",
    workspace: "مساحة العمل",
    language: "اللغة",
    signOut: "الحساب",
    welcomeTitle: "قم بإعداد مساحة Mizan",
    welcomeSubtitle: "اختر لغة العمل، واسم الشركة، ثم جهّز مساحة التركيب الخاصة بك.",
    companyName: "اسم الشركة",
    startTutorial: "بدء الدليل",
    completeOnboarding: "إنهاء التهيئة",
    next: "التالي",
    previous: "السابق",
    stepTenant: "مساحتك معزولة",
    stepTenantText: "كل مستخدم أو منظمة في Clerk لديها مواد وتركيبات ونتائج منفصلة.",
    stepData: "بيانات البداية جاهزة",
    stepDataText: "يقوم Mizan بتهيئة كتالوج INRAE مرجعي داخل مساحة عملك مع إبقاء تعديلاتك معزولة.",
    stepSolver: "محرك multi-blend",
    stepSolverText: "فعّل المواد الأولية، وحدد القيود، ثم دع المحرك يوزع المخزون بأفضل تكلفة.",
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

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
  document.documentElement.dataset.locale = locale;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "fr";
    const saved = window.localStorage.getItem("mizan-locale") as Locale | null;
    return saved && saved in dictionaries ? saved : "fr";
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem("mizan-locale", nextLocale);
    applyDocumentLocale(nextLocale);
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
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
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
