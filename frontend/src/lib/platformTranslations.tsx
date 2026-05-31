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
  "Code": { en: "Code", ar: "الرمز" },
  "Code MP": { en: "Ingredient code", ar: "رمز المادة" },
  "Code Formule": { en: "Recipe code", ar: "رمز التركيبة" },
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
  "Tous les ingrédients": { en: "All ingredients", ar: "كل المكونات" },
  "Gestion des Stocks": { en: "Inventory management", ar: "إدارة المخزون" },
  "matière première": { en: "ingredient", ar: "مادة أولية" },
  "matières premières": { en: "ingredients", ar: "مواد أولية" },
  "Stock Actif": { en: "Active stock", ar: "مخزون نشط" },
  "Base Inactive": { en: "Inactive base", ar: "قاعدة غير نشطة" },
  "Sauvegarder": { en: "Save", ar: "حفظ" },
  "Ajouter": { en: "Add", ar: "إضافة" },
  "Supprimer": { en: "Delete", ar: "حذف" },
  "Annuler": { en: "Cancel", ar: "إلغاء" },
  "Rechercher une matière première...": { en: "Search an ingredient...", ar: "ابحث عن مادة أولية..." },
  "Nom": { en: "Name", ar: "الاسم" },
  "Statut": { en: "Status", ar: "الحالة" },
  "Coût TND/kg": { en: "Cost TND/kg", ar: "التكلفة TND/كغ" },
  "MS %": { en: "DM %", ar: "المادة الجافة %" },
  "Protéine %": { en: "Protein %", ar: "البروتين %" },
  "Stock (t)": { en: "Inventory (t)", ar: "المخزون (طن)" },
  "Fiche Technique": { en: "Technical sheet", ar: "البطاقة الفنية" },
  "Fiche de Fabrication": { en: "Manufacturing sheet", ar: "بطاقة التصنيع" },
  "Fiche Technique Officielle": { en: "Official technical sheet", ar: "البطاقة الفنية الرسمية" },
  "Tonnage Produit": { en: "Produced tonnage", ar: "الكمية المنتجة" },
  "Matières Chargées": { en: "Loaded materials", ar: "المواد المحملة" },
  "Coût Total Estimé": { en: "Estimated total cost", ar: "التكلفة الإجمالية المقدرة" },
  "Composition de la Formule": { en: "Recipe composition", ar: "تركيبة الوصفة" },
  "Quantité (kg)": { en: "Quantity (kg)", ar: "الكمية (كغ)" },
  "Quantité (tonnes)": { en: "Quantity (tons)", ar: "الكمية (طن)" },
  "Proportion (%)": { en: "Proportion (%)", ar: "النسبة (%)" },
  "Total Charges": { en: "Total loaded", ar: "إجمالي التحميل" },
  "Valeurs Nutritionnelles Atteintes": { en: "Achieved nutritional values", ar: "القيم الغذائية المحققة" },
  "Exporter en CSV": { en: "Export CSV", ar: "تصدير CSV" },
  "Préparation...": { en: "Preparing...", ar: "جار التحضير..." },
  "Imprimer la Fiche": { en: "Print sheet", ar: "طباعة البطاقة" },
  "Espèce :": { en: "Species:", ar: "النوع:" },
  "Date :": { en: "Date:", ar: "التاريخ:" },
  "Ingrédient": { en: "Ingredient", ar: "المكون" },
  "Inclusion (%)": { en: "Inclusion (%)", ar: "نسبة الإدخال (%)" },
  "Quantité (kg/T)": { en: "Quantity (kg/T)", ar: "الكمية (كغ/طن)" },
  "Paramètre / Nutriment": { en: "Parameter / nutrient", ar: "المعيار / القيمة الغذائية" },
  "Valeur Calculée": { en: "Calculated value", ar: "القيمة المحسوبة" },
  "Cible Min/Max": { en: "Min/max target", ar: "هدف الحد الأدنى/الأقصى" },
  "Aucun ingrédient ne correspond à votre recherche.": {
    en: "No ingredient matches your search.",
    ar: "لا توجد مادة تطابق بحثك.",
  },
  "Détails": { en: "Details", ar: "التفاصيل" },
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
  "paramètres": { en: "parameters", ar: "معايير" },
  "paramètres affichés": { en: "displayed parameters", ar: "معايير معروضة" },
  "Filtrer les paramètres...": { en: "Filter parameters...", ar: "تصفية المعايير..." },
  "Composition Générale": { en: "General composition", ar: "التركيب العام" },
  "valeurs": { en: "values", ar: "قيم" },
  "Aucun paramètre ne correspond à": { en: "No parameter matches", ar: "لا يوجد معيار يطابق" },
  "Aucun nutriment enregistré. Ajoutez-en via le menu ci-dessous.": {
    en: "No nutrient saved. Add one from the menu below.",
    ar: "لا يوجد عنصر غذائي محفوظ. أضفه من القائمة أدناه.",
  },
  "+ Ajouter un nutriment...": { en: "+ Add a nutrient...", ar: "+ إضافة عنصر غذائي..." },
  "Ajouter un nutriment...": { en: "Add a nutrient...", ar: "إضافة عنصر غذائي..." },
  "Nom du nouveau nutriment :": { en: "New nutrient name:", ar: "اسم العنصر الغذائي الجديد:" },
  "Fermer": { en: "Close", ar: "إغلاق" },
  "Sauvegarder la fiche": { en: "Save sheet", ar: "حفظ البطاقة" },
  "Fiche technique sauvegardée !": { en: "Technical sheet saved!", ar: "تم حفظ البطاقة الفنية!" },
  "Erreur lors de la sauvegarde.": { en: "Error while saving.", ar: "حدث خطأ أثناء الحفظ." },
  "Erreur lors de la sauvegarde de la fiche.": {
    en: "Error while saving the sheet.",
    ar: "حدث خطأ أثناء حفظ البطاقة.",
  },
  "Supprimer cet ingrédient ?": { en: "Delete this ingredient?", ar: "حذف هذه المادة؟" },
  "Nouvelle Matière": { en: "New ingredient", ar: "مادة جديدة" },
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
  "Sélectionner les Formules à Optimiser": { en: "Select recipes to optimize", ar: "اختر التركيبات للتحسين" },
  "formules sélectionnées": { en: "selected recipes", ar: "تركيبات محددة" },
  "Tout sélectionner": { en: "Select all", ar: "تحديد الكل" },
  "Tout désélectionner": { en: "Deselect all", ar: "إلغاء تحديد الكل" },
  "Par défaut, aucune formule n'est sélectionnée. Choisissez les formules à inclure avant de lancer le solveur.": {
    en: "By default, no recipe is selected. Choose the recipes to include before running the solver.",
    ar: "افتراضيا لا توجد أي تركيبة محددة. اختر التركيبات التي تريد تضمينها قبل تشغيل المحرك.",
  },
  "Sélectionnez au moins une formule": { en: "Select at least one recipe", ar: "حدد تركيبة واحدة على الأقل" },
  "Sélectionnez au moins une formule à optimiser.": {
    en: "Select at least one recipe to optimize.",
    ar: "حدد تركيبة واحدة على الأقل لتحسينها.",
  },
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
  "Chargement...": { en: "Loading...", ar: "جار التحميل..." },
  "Moteur d'optimisation multi-tenant": {
    en: "Multi-tenant optimization engine",
    ar: "محرك تحسين متعدد المساحات",
  },
  "Administration": { en: "Administration", ar: "الإدارة" },
  "Centre admin": { en: "Admin center", ar: "مركز الإدارة" },
  "Acces admin requis": { en: "Admin access required", ar: "يتطلب صلاحية الإدارة" },
  "Accès admin requis": { en: "Admin access required", ar: "يتطلب صلاحية الإدارة" },
  "Monitoring production, historique solveur et audit trail tenant.": {
    en: "Production monitoring, solver history and tenant audit trail.",
    ar: "مراقبة الإنتاج، وسجل المحرك، ومسار تدقيق مساحة العمل.",
  },
  "Actualiser": { en: "Refresh", ar: "تحديث" },
  "Chargement du monitoring...": { en: "Loading monitoring...", ar: "جار تحميل المراقبة..." },
};

const spanishTranslations: Record<string, string> = {
  "Bonjour": "Hola",
  "Tableau de Bord": "Panel de control",
  "Indicateurs Clés": "Indicadores clave",
  "Raccourcis Rapides": "Accesos rápidos",
  "Matières Premières": "Materias primas",
  "Formules": "Fórmulas",
  "Optimisation": "Optimización",
  "Optimisation de l'Usine": "Optimización de fábrica",
  "Achats & Stratégie": "Compras y estrategia",
  "Achats & stratégie": "Compras y estrategia",
  "Tableau de bord du Directeur des Achats — Prix d'Intérêt, négociations et intelligence artificielle.": "Panel del director de compras: precios sombra, negociaciones e inteligencia artificial.",
  "Lancez d'abord une optimisation pour générer les données de Shadow Pricing.": "Ejecute primero una optimización para generar los datos de precios sombra.",
  "Lancer l'Optimisation de l'Usine": "Ejecutar optimización de fábrica",
  "Optimisation en cours…": "Optimización en curso...",
  "Ingrédients Non Retenus": "Ingredientes no utilizados",
  "Plus Proche de Rentabilité": "Más cerca de la rentabilidad",
  "matières avec Prix d'Intérêt": "materias con precio sombra",
  "Toutes les matières sont utilisées.": "Todas las materias están utilizadas.",
  "Opportunités de Négociation (Shadow Prices)": "Oportunidades de negociación (precios sombra)",
  "Classé par proximité de rentabilité — le premier de la liste est l'effort de négociation le plus faible.": "Ordenado por proximidad a la rentabilidad: la primera fila requiere el menor esfuerzo de negociación.",
  "Matière Première": "Materia prima",
  "Code": "Código",
  "Code MP": "Código MP",
  "Code Formule": "Código de fórmula",
  "Formule": "Fórmula",
  "Coût Actuel (TND/kg)": "Coste actual (TND/kg)",
  "Prix Cible (TND/kg)": "Precio objetivo (TND/kg)",
  "Effort Requis": "Esfuerzo requerido",
  "Signal": "Señal",
  "Négociable": "Negociable",
  "Éloigné": "Lejano",
  "Toutes les matières premières sont utilisées dans cette optimisation.": "Todas las materias primas se utilizan en esta optimización.",
  "Aucun prix d'intérêt à exploiter.": "No hay precio sombra que explotar.",
  "Recommandations Stratégiques de l'IA": "Recomendaciones estratégicas de IA",
  "Analyser avec l'IA Mizan": "Analizar con IA Mizan",
  "Analyse en cours...": "Análisis en curso...",
  "Cliquez sur \"Analyser avec l'IA Mizan\" pour générer des recommandations financières ciblées.": "Haga clic en \"Analizar con IA Mizan\" para generar recomendaciones financieras específicas.",
  "L'IA utilisera les données de Shadow Pricing pour identifier les meilleures cibles de négociation.": "La IA utilizará los datos de precios sombra para identificar los mejores objetivos de negociación.",
  "Relancer une Optimisation": "Ejecutar otra optimización",
  "Créer une nouvelle formule": "Crear una nueva fórmula",
  "Mettre à jour les stocks": "Actualizar inventario",
  "Lancer la production": "Lanzar producción",
  "Accéder": "Abrir",
  "Chargement des données ERP…": "Cargando datos ERP...",
  "Matières Premières Actives": "Materias primas activas",
  "Formules Master": "Fórmulas maestras",
  "Statut du Solveur": "Estado del optimizador",
  "En ligne": "En línea",
  "dans l'inventaire": "en inventario",
  "en production": "en producción",
  "Recherche": "Búsqueda",
  "Tous": "Todos",
  "Tous les ingrédients": "Todos los ingredientes",
  "Gestion des Stocks": "Gestión de inventario",
  "matière première": "materia prima",
  "matières premières": "materias primas",
  "Stock Actif": "Stock activo",
  "Base Inactive": "Base inactiva",
  "Sauvegarder": "Guardar",
  "Ajouter": "Añadir",
  "Supprimer": "Eliminar",
  "Annuler": "Cancelar",
  "Rechercher une matière première...": "Buscar una materia prima...",
  "Nom": "Nombre",
  "Statut": "Estado",
  "Coût TND/kg": "Coste TND/kg",
  "MS %": "MS %",
  "Protéine %": "Proteína %",
  "Stock (t)": "Stock (t)",
  "Fiche Technique": "Ficha técnica",
  "Fiche de Fabrication": "Ficha de fabricación",
  "Fiche Technique Officielle": "Ficha técnica oficial",
  "Tonnage Produit": "Tonelaje producido",
  "Matières Chargées": "Materias cargadas",
  "Coût Total Estimé": "Coste total estimado",
  "Composition de la Formule": "Composición de la fórmula",
  "Quantité (kg)": "Cantidad (kg)",
  "Quantité (tonnes)": "Cantidad (toneladas)",
  "Proportion (%)": "Proporción (%)",
  "Total Charges": "Total cargado",
  "Valeurs Nutritionnelles Atteintes": "Valores nutricionales alcanzados",
  "Exporter en CSV": "Exportar a CSV",
  "Préparation...": "Preparando...",
  "Imprimer la Fiche": "Imprimir ficha",
  "Espèce :": "Especie:",
  "Date :": "Fecha:",
  "Ingrédient": "Ingrediente",
  "Inclusion (%)": "Inclusión (%)",
  "Quantité (kg/T)": "Cantidad (kg/T)",
  "Paramètre / Nutriment": "Parámetro / Nutriente",
  "Valeur Calculée": "Valor calculado",
  "Cible Min/Max": "Objetivo mín/máx",
  "Aucun ingrédient ne correspond à votre recherche.": "Ningún ingrediente coincide con su búsqueda.",
  "Détails": "Detalles",
  "Coût": "Coste",
  "Transport": "Transporte",
  "Stock": "Inventario",
  "Actif": "Activo",
  "Inactif": "Inactivo",
  "Espèce": "Especie",
  "Demande": "Demanda",
  "Rendement": "Rendimiento",
  "Contraintes": "Restricciones",
  "Nutriment": "Nutriente",
  "paramètres": "parámetros",
  "paramètres affichés": "parámetros mostrados",
  "Filtrer les paramètres...": "Filtrar parámetros...",
  "Composition Générale": "Composición general",
  "valeurs": "valores",
  "Aucun paramètre ne correspond à": "Ningún parámetro coincide con",
  "Aucun nutriment enregistré. Ajoutez-en via le menu ci-dessous.": "No hay nutrientes guardados. Añada uno desde el menú inferior.",
  "+ Ajouter un nutriment...": "+ Añadir un nutriente...",
  "Ajouter un nutriment...": "Añadir un nutriente...",
  "Nom du nouveau nutriment :": "Nombre del nuevo nutriente:",
  "Fermer": "Cerrar",
  "Sauvegarder la fiche": "Guardar ficha",
  "Fiche technique sauvegardée !": "Ficha técnica guardada.",
  "Erreur lors de la sauvegarde.": "Error al guardar.",
  "Erreur lors de la sauvegarde de la fiche.": "Error al guardar la ficha.",
  "Supprimer cet ingrédient ?": "¿Eliminar este ingrediente?",
  "Nouvelle Matière": "Nueva materia",
  "Choisir un nutriment...": "Elegir un nutriente...",
  "Min": "Mín",
  "Max": "Máx",
  "Pas": "Puntos",
  "Analyse Paramétrique": "Análisis paramétrico",
  "Générer la Courbe de Coût": "Generar curva de coste",
  "Certains points sont infaisables.": "Algunos puntos no son factibles.",
  "Calcul en cours…": "Calculando...",
  "Résultats d'Optimisation": "Resultados de optimización",
  "Lancer l'Optimisation": "Ejecutar optimización",
  "Sélectionner les Formules à Optimiser": "Seleccionar fórmulas para optimizar",
  "formules sélectionnées": "fórmulas seleccionadas",
  "Tout sélectionner": "Seleccionar todo",
  "Tout désélectionner": "Deseleccionar todo",
  "Par défaut, aucune formule n'est sélectionnée. Choisissez les formules à inclure avant de lancer le solveur.": "Por defecto no hay ninguna fórmula seleccionada. Elija las fórmulas que desea incluir antes de ejecutar el optimizador.",
  "Sélectionnez au moins une formule": "Seleccione al menos una fórmula",
  "Sélectionnez au moins une formule à optimiser.": "Seleccione al menos una fórmula para optimizar.",
  "Audit IA": "Auditoría IA",
  "Diagnostic IA": "Diagnóstico IA",
  "Paramétrique": "Paramétrico",
  "Coût Total Usine": "Coste total de fábrica",
  "Coût (TND)": "Coste (TND)",
  "Infaisable": "No factible",
  "Atteint": "Alcanzado",
  "Cible": "Objetivo",
  "Cible/Min": "Objetivo/Mín",
  "Précédent": "Anterior",
  "Suivant": "Siguiente",
  "Terminer l'onboarding": "Finalizar configuración",
  "Chargement...": "Cargando...",
  "Moteur d'optimisation multi-tenant": "Motor de optimización multi-tenant",
  "Administration": "Administración",
  "Centre admin": "Centro admin",
  "Acces admin requis": "Acceso admin requerido",
  "Accès admin requis": "Acceso admin requerido",
  "Monitoring production, historique solveur et audit trail tenant.": "Monitoreo de producción, historial del optimizador y auditoría del espacio.",
  "Actualiser": "Actualizar",
  "Chargement du monitoring...": "Cargando monitoreo...",
};

for (const [source, es] of Object.entries(spanishTranslations)) {
  translations[source] = { ...(translations[source] ?? {}), es };
}

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
  if (element.hasAttribute("data-no-translate") || element.closest("[data-no-translate]")) return;
  if (element.getAttribute("contenteditable") === "true") return;
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

    let frame = 0;
    const scheduleApply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    const observer = new MutationObserver(() => {
      scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [locale]);

  return null;
}
