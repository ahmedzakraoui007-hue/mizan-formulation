"use client";

import { Zap, Target, AlertTriangle, Bot, BrainCircuit, LineChart as LucideLineChart, FileText, Printer, Search, Eye, X, History, ShieldCheck, CheckCircle2, Lightbulb, ClipboardCheck } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import ReactMarkdown from "react-markdown";
import FicheModal from "@/components/FicheModal";
import PageLoader from "@/components/PageLoader";
import { buildSolverRecipes, countSelectedRecipes, getRecipeIds } from "@/lib/optimizationSelection";
import { useI18n } from "@/lib/i18n";
import { canRunOptimization, useTenantRole } from "@/lib/tenantRole";
import { getNutrientUnit, getTopNutrients } from "@/utils/nutrientUtils";
import { apiUrl } from "@/lib/api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#059669', '#ea580c'];

interface ConstraintConfig {
  min?: number;
  max?: number;
  exact?: number;
}

interface IngredientLite {
  id: number;
  code?: string | null;
  name: string;
  inventory_limit_tons?: number;
  is_active?: boolean | null;
}

interface RecipeItem {
  id: number;
  code?: string | null;
  name: string;
  demand_tons: number;
  constraints?: Record<string, ConstraintConfig>;
  process_yield_percent?: number;
  bag_size_kg?: number;
  parent_id?: number | null;
  version_tag?: string;
  species?: string;
  versions?: RecipeItem[];
  [key: string]: unknown;
}

interface ResultIngredient {
  code?: string | null;
  name: string;
  tons: number;
  percentage: number;
}

interface RecipeResult {
  code?: string | null;
  name: string;
  demand_tons: number;
  raw_tons: number;
  process_yield_percent: number;
  cost_tnd: number;
  bag_size_kg: number;
  cost_per_bag_tnd: number;
  ingredients: ResultIngredient[];
  nutrients: Record<string, number>;
  shadow_prices?: unknown[];
}

interface MultiBlendResult {
  status: string;
  total_factory_cost_tnd: number;
  recipes: RecipeResult[];
}

interface OptimizationRun {
  id: number;
  status: string;
  total_factory_cost_tnd: number | null;
  recipe_count: number;
  ingredient_count: number;
  duration_ms: number;
  created_at: string | null;
}

interface BusinessScore {
  label: string;
  score: number;
  status: "good" | "watch" | "risk";
  detail: string;
}

interface BusinessAlert {
  severity: "success" | "info" | "warning" | "critical";
  title: string;
  detail: string;
  evidence?: string;
}

interface BusinessRecommendation {
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
  impact: string;
  estimated_savings_tnd?: number | null;
  validation: {
    status: "validated" | "simulation_only" | "data_check";
    label: string;
    method: string;
  };
}

interface BusinessReview {
  is_grounded: boolean;
  global_score: number;
  summary: string;
  scores: Record<string, BusinessScore>;
  alerts: BusinessAlert[];
  recommendations: BusinessRecommendation[];
  guardrails: string[];
}

const isActiveIngredient = (ingredient: IngredientLite) => ingredient.is_active === true || ingredient.is_active == null;

const formatRunDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
};

const scoreTone = (status: BusinessScore["status"]) => {
  if (status === "good") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (status === "watch") return "border-amber-100 bg-amber-50 text-amber-800";
  return "border-red-100 bg-red-50 text-red-800";
};

const alertTone = (severity: BusinessAlert["severity"]) => {
  if (severity === "success") return "border-emerald-100 bg-emerald-50 text-emerald-900";
  if (severity === "info") return "border-blue-100 bg-blue-50 text-blue-900";
  if (severity === "warning") return "border-amber-100 bg-amber-50 text-amber-900";
  return "border-red-100 bg-red-50 text-red-900";
};

const validationTone = (status: BusinessRecommendation["validation"]["status"]) => {
  if (status === "validated") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "simulation_only") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

export default function OptimizationPage() {
  const { t, locale } = useI18n();
  const tenantRole = useTenantRole();
  const canOptimize = canRunOptimization(tenantRole);

  const [ingredients, setIngredients] = useState<IngredientLite[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [unselectedRecipeIds, setUnselectedRecipeIds] = useState<number[]>([]);

  const [result, setResult] = useState<MultiBlendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  // Veterinary Auditor AI State
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Solver-grounded AI business review
  const [businessReview, setBusinessReview] = useState<BusinessReview | null>(null);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Diagnosis AI State
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<string | null>(null);

  // Parametric Analysis State
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [paramNutrient, setParamNutrient] = useState("");
  const [paramStart, setParamStart] = useState("");
  const [paramEnd, setParamEnd] = useState("");
  const [paramSteps, setParamSteps] = useState("10");
  const [paramData, setParamData] = useState<{ nutrient_value: number; cost: number | null }[]>([]);
  const [paramLoading, setParamLoading] = useState(false);
  const [paramLabel, setParamLabel] = useState("");
  const [paramError, setParamError] = useState<string | null>(null);
  const [paramTargetRecipeName, setParamTargetRecipeName] = useState("");
  const [paramConstraintMode, setParamConstraintMode] = useState<"min" | "max" | "exact">("min");

  // ─── Dynamic Parametric Bounds ──────────────────────────────────────────
  useEffect(() => {
    if (!paramNutrient || recipes.length === 0) return;

    // Find the current constraint for this nutrient in any recipe
    // Since parametric analysis in backend overrides ALL recipes with this value,
    // we take the first recipe that has this constraint as a reference point.
    let currentVal: number | null = null;
    const flat = recipes.flatMap((r) => [r, ...(r.versions || [])]);
    for (const r of flat) {
      if (r.constraints?.[paramNutrient]) {
        const c = r.constraints[paramNutrient];
        if (c.min !== undefined) currentVal = c.min;
        else if (c.exact !== undefined) currentVal = c.exact;
        if (currentVal !== null) break;
      }
    }

    if (currentVal !== null) {
      // Set default range to ±15% of current value
      const start = Math.max(0, currentVal * 0.85).toFixed(2);
      const end = (currentVal * 1.15).toFixed(2);
      setParamStart(start);
      setParamEnd(end);
    }
  }, [paramNutrient, recipes]);

  // Stats
  const [stockStats, setStockStats] = useState({ total_stock: 0, total_demand: 0 });
  const [selectedReport, setSelectedReport] = useState<RecipeResult | null>(null);
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<OptimizationRun[]>([]);

  const fetchRecentRuns = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/optimization-runs?limit=5"));
      if (res.ok) setRecentRuns(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        // Use lite=true: optimization page only needs ingredient IDs and is_active
        fetch(apiUrl("/api/ingredients?lite=true")),
        fetch(apiUrl("/api/recipes")),
      ]);
      if (ingRes.ok && recRes.ok) {
        const ings = await ingRes.json();
        const recs = await recRes.json();
        setIngredients(ings);
        setRecipes(recs);
        setUnselectedRecipeIds(getRecipeIds(recs));

        // Active = explicitly true (the migration now ensures all rows have a value)
        const activeIngs = (ings as IngredientLite[]).filter(isActiveIngredient);
        const tStock = activeIngs.reduce((s, i) => s + (i.inventory_limit_tons || 0), 0);
        // Count all recipes: masters + their versions
        const tDemand = (recs as RecipeItem[]).reduce((s, r) => {
          const masterDemand = r.demand_tons || 0;
          const versionsDemand = (r.versions || []).reduce((vs, v) => vs + (v.demand_tons || 0), 0);
          return s + masterDemand + versionsDemand;
        }, 0);
        setStockStats({ total_stock: tStock, total_demand: tDemand });
      }
    } catch { /* ignored */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchRecentRuns(); }, [fetchRecentRuns]);

  const allRecipeIds = getRecipeIds(recipes);
  const selectedRecipeCount = countSelectedRecipes(recipes, unselectedRecipeIds);
  const totalRecipeCount = allRecipeIds.length;
  const hasSelectedRecipes = selectedRecipeCount > 0;
  const selectedSolverRecipeOptions = buildSolverRecipes(recipes, unselectedRecipeIds)
    .map((recipe) => String(recipe.name || ""))
    .filter(Boolean);

  const setRecipeSelected = (id: number, selected: boolean) => {
    setUnselectedRecipeIds(prev => {
      if (selected) return prev.filter(recipeId => recipeId !== id);
      return prev.includes(id) ? prev : [...prev, id];
    });
  };

  const selectAllRecipes = () => setUnselectedRecipeIds([]);
  const deselectAllRecipes = () => setUnselectedRecipeIds(allRecipeIds);

  const getOriginalRecipe = (name: string) => {
    // Search in masters and versions
    for (const master of recipes) {
      if (master.name === name) return master;
      if (master.versions) {
        const v = master.versions.find((version) => version.version_tag === name || `${master.name} (${version.version_tag})` === name || version.name === name);
        if (v) return v;
      }
    }
    return recipes.find(r => name.startsWith(r.name));
  };

  const runFactory = async () => {
    if (!canOptimize) {
      setError(t("roleReadOnlyOptimization"));
      return;
    }
    setLoading(true); setError(null); setResult(null); setDiagnoseResult(null); setAuditResult(null); setBusinessReview(null); setBusinessError(null);
    try {
      // Send ALL active ingredients to the solver.
      const ingredientIds = ingredients
        .filter(isActiveIngredient)
        .map((i) => i.id);

      // Flatten the recipe list: include the master recipe AND every version.
      // The backend solver treats each entry as a separate independent formula.
      // Masters and versions are both complete Recipe objects with their own
      // demand_tons, constraints, and species — the solver optimizes all of them together
      // sharing a global ingredient inventory pool.
      const flatRecipes = buildSolverRecipes(recipes, unselectedRecipeIds);

      if (flatRecipes.length === 0) {
        throw new Error(t("selectAtLeastOneRecipe"));
      }

      const res = await fetch(apiUrl("/api/optimize-multi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_ids: ingredientIds,
          recipes: flatRecipes,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Échec de l'optimisation"); }
      const json = await res.json();
      setResult(json);
      setBusinessLoading(true);
      fetch(apiUrl("/api/ai-business-review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_ids: ingredientIds,
          recipes: flatRecipes,
          result: json,
          locale,
        }),
      })
        .then(async (reviewRes) => {
          if (!reviewRes.ok) {
            const payload = await reviewRes.json().catch(() => ({}));
            throw new Error(payload.detail || t("aiBusinessReviewError"));
          }
          setBusinessReview(await reviewRes.json());
        })
        .catch((reviewErr: unknown) => {
          setBusinessError(reviewErr instanceof Error ? reviewErr.message : t("aiBusinessReviewError"));
        })
        .finally(() => setBusinessLoading(false));
      fetchRecentRuns();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { setLoading(false); }
  };

  const buildOptimizationPayload = () => {
    const ingredientIds = ingredients
      .filter(isActiveIngredient)
      .map((i) => i.id);

    const flatRecipes = buildSolverRecipes(recipes, unselectedRecipeIds);

    return { ingredientIds, flatRecipes };
  };

  const getChartData = (rec: RecipeResult, originalRec?: RecipeItem) => {
    const species = originalRec?.species || "General";
    return getTopNutrients(rec.nutrients, originalRec?.constraints, species)
      .map(([key, val]) => {
        const c = originalRec?.constraints?.[key];
        let cible = 0;
        if (c?.exact !== undefined) cible = c.exact;
        else if (c?.min !== undefined) cible = c.min;
        const factor = val > 1000 ? 100 : 1;
        const displayName = val > 1000 ? `${key} (/100)` : key;
        return { name: displayName, cible: cible / factor, atteint: val / factor };
      });
  };

  const exportPDF = async (rec: RecipeResult) => {
    setExportingPdf(rec.name);
    try {
      const el = document.getElementById(`pdf-template-${rec.name}`);
      if (!el) return;

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Fiche_Technique_${rec.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingPdf(null);
    }
  };

  const getKeysToPrint = (nutrients: Record<string, number>, constraints: Record<string, any> | undefined, species: string = "General"): [string, number][] => {
    return getTopNutrients(nutrients, constraints, species);
  };

  const exportCSV = (rec: RecipeResult, originalRec?: RecipeItem) => {
    const constraintKeys = originalRec?.constraints ?? {};
    const species = originalRec?.species || "General";
    const filteredNutrients = getKeysToPrint(rec.nutrients, constraintKeys, species);

    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv += `Code;${rec.code || ""};Recette;${rec.name};Espèce;${originalRec?.species || 'Générale'};Date;${new Date().toLocaleDateString('fr-FR')}\n`;
    csv += `\n`;
    csv += `Code;Matière Première;Inclusion (%);Quantité (kg/T)\n`;
    for (const ing of rec.ingredients) {
      csv += `${ing.code || ""};${ing.name};${Math.round(ing.percentage)}%;${Math.round(ing.percentage * 10)}\n`;
    }
    csv += `\n`;
    csv += `Paramètre Nutritionnel;Valeur Calculée;Cible Min/Max\n`;
    for (const [key, val] of filteredNutrients) {
      const cons = constraintKeys[key];
      let cibleStr = '—';
      if (cons) {
        if (cons.exact !== undefined) cibleStr = `Exact: ${cons.exact}`;
        else if (cons.min !== undefined && cons.max !== undefined) cibleStr = `${cons.min} - ${cons.max}`;
        else if (cons.min !== undefined) cibleStr = `Min: ${cons.min}`;
        else if (cons.max !== undefined) cibleStr = `Max: ${cons.max}`;
      }
      csv += `${key};${val.toFixed(2)};${cibleStr}\n`;
    }
    csv += `\n`;
    csv += `Coût Total (TND);${rec.cost_tnd.toFixed(2)}\n`;
    csv += `Coût par Tonne (TND/T);${(rec.cost_tnd / rec.demand_tons).toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fiche_Technique_${rec.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runAudit = async () => {
    if (!result) return;
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const res = await fetch(apiUrl("/api/ai-audit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("Erreur de l'API IA Audit");
      const data = await res.json();
      setAuditResult(data.markdown);
    } catch {
      setAuditResult("❌ Impossible de générer l'audit. Vérifiez la clé GEMINI_API_KEY dans le backend.");
    } finally {
      setAuditLoading(false);
    }
  };

  const askAIWhy = async () => {
    if (!error) return;
    setDiagnoseLoading(true); setDiagnoseResult(null);
    let failedName = recipes[0]?.name || "Recette Inconnue";
    const match = error.match(/Recette '(.*?)'/);
    if (match) failedName = match[1];
    const failedRec = recipes.find(r => r.name === failedName) || recipes[0];

    try {
      const res = await fetch(apiUrl("/api/recipes/diagnose-infeasible"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_name: failedRec.name,
          constraints: failedRec.constraints || {},
          available_ingredients: ingredients.filter(i => i.is_active === true || i.is_active == null).map(i => i.name)
        }),
      });
      const data = await res.json();
      setDiagnoseResult(data.markdown);
    } catch {
      setDiagnoseResult("❌ Impossible de joindre l'IA.");
    } finally { setDiagnoseLoading(false); }
  };

  if (fetching) {
    return <PageLoader label={t("loadingErpData")} />;
  }

  return (
    <>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/60 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-50/40 via-transparent to-transparent pointer-events-none" />

        <div className="relative p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 print:hidden z-10">
          <div className="mb-12">
            <h1 className="text-[2.5rem] font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Zap className="w-9 h-9 text-emerald-500" /> {t("factoryOptimization")}
            </h1>
            <p className="text-slate-500 mt-2 text-lg font-medium tracking-wide">
              {t("optimizationSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t("totalDemandBook")}</p>
              <div className="text-[2.5rem] font-black text-slate-900 tracking-tighter">{stockStats.total_demand.toFixed(1)} <span className="text-xl text-slate-400 font-bold">{t("tons")}</span></div>
              <p className="text-sm font-bold text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-full inline-block">
                {recipes.reduce((c, r) => c + 1 + (r.versions?.length || 0), 0)} {t("recipesToProduce")}
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t("siloCapacity")}</p>
              <div className="text-[2.5rem] font-black text-slate-900 tracking-tighter">{stockStats.total_stock.toFixed(1)} <span className="text-xl text-slate-400 font-bold">{t("tons")}</span></div>
              <p className="text-sm font-bold text-emerald-600 mt-2 bg-emerald-50 px-3 py-1.5 rounded-full inline-block text-center">{ingredients.length} {t("availableIngredients")}</p>
            </div>
          </div>

          <div className="mb-10 bg-white/60 backdrop-blur-3xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <History className="h-5 w-5 text-emerald-600" /> Historique recent
              </h3>
              <button
                type="button"
                onClick={fetchRecentRuns}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50"
              >
                Actualiser
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {recentRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase ${run.status === "optimal" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {run.status}
                  </span>
                  <p className="mt-3 text-sm font-black text-slate-900">
                    {run.total_factory_cost_tnd == null ? "-" : `${run.total_factory_cost_tnd.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} TND`}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{run.recipe_count} formules · {Math.round(run.duration_ms)} ms</p>
                  <p className="mt-2 text-[10px] font-bold text-slate-400">{formatRunDate(run.created_at)}</p>
                </div>
              ))}
              {recentRuns.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-sm font-semibold text-slate-400 md:col-span-5">
                  Aucun historique solveur pour le moment.
                </div>
              )}
            </div>
          </div>

          <div className="mb-10 bg-white/60 backdrop-blur-3xl p-8 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" /> {t("selectRecipesToOptimize")}
                </h3>
                <p className="text-sm text-slate-500 font-semibold mt-1">
                  {selectedRecipeCount} / {totalRecipeCount} {t("selectedRecipes")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllRecipes}
                  className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-sm font-black transition-colors"
                >
                  {t("selectAll")}
                </button>
                <button
                  type="button"
                  onClick={deselectAllRecipes}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-sm font-black transition-colors"
                >
                  {t("deselectAll")}
                </button>
              </div>
            </div>
            {!hasSelectedRecipes && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                {t("noRecipeSelectedHint")}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {recipes.map((master) => (
                <div key={master.id} className="flex flex-col gap-2">
                  <label className={`flex items-center gap-3 cursor-pointer p-4 bg-white hover:bg-slate-50/80 rounded-2xl border transition-all shadow-sm hover:shadow-md ${!unselectedRecipeIds.includes(master.id) ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-100"}`}>
                    <input type="checkbox" className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 flex-shrink-0"
                      checked={!unselectedRecipeIds.includes(master.id)}
                      onChange={(e) => setRecipeSelected(master.id, e.target.checked)}
                    />
                    <span className="text-sm font-black text-slate-800 line-clamp-1">{master.name}</span>
                  </label>
                  {master.versions?.map((v) => (
                    <label key={v.id} className={`flex items-center gap-3 cursor-pointer p-2.5 pl-8 rounded-xl border transition-colors ${!unselectedRecipeIds.includes(v.id) ? "bg-emerald-50 border-emerald-100" : "bg-slate-50/50 hover:bg-slate-100 border-transparent"}`}>
                      <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 flex-shrink-0"
                        checked={!unselectedRecipeIds.includes(v.id)}
                        onChange={(e) => setRecipeSelected(v.id, e.target.checked)}
                      />
                      <span className="text-xs font-bold text-slate-500 line-clamp-1">↳ {v.version_tag}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <button onClick={runFactory} disabled={loading || !hasSelectedRecipes || !canOptimize}
            className={`relative w-full py-6 rounded-[2rem] font-black text-xl tracking-wide transition-all overflow-hidden ${loading || !hasSelectedRecipes || !canOptimize ? "bg-slate-200 cursor-not-allowed text-slate-400 shadow-none" : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_40px_rgba(16,185,129,0.5)] hover:-translate-y-1 cursor-pointer"
              }`}>
            {loading ? t("optimizationRunning") : <span className="flex items-center justify-center gap-3"><Zap className="w-7 h-7" /> {!canOptimize ? t("readOnlyMode") : hasSelectedRecipes ? t("runFactoryOptimization") : t("selectAtLeastOneRecipe")}</span>}
          </button>

          {error && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-red-700 text-lg font-bold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Échec Logique du Solveur Mathématique
                  </p>
                  <p className="text-red-600 mt-2 font-medium">{error}</p>
                  <p className="text-red-500 text-xs mt-1">Les ingrédients disponibles ne permettent pas de satisfaire les contraintes Minimales et Maximales simultanément.</p>
                </div>
                <button onClick={askAIWhy} disabled={diagnoseLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2 flex-shrink-0">
                  {diagnoseLoading ? "⏳ Résolution en cours..." : <><Bot className="w-4 h-4" /> Demander à l'IA pourquoi ?</>}
                </button>
              </div>

              {diagnoseResult && (
                <div className="mt-6 bg-white border border-red-100 rounded-xl p-6 shadow-sm animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-indigo-600" /> Diagnostic IA Mizan</h3>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>{diagnoseResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="mt-16 space-y-10 animate-in slide-in-from-bottom-8 duration-1000">
              <div className="bg-slate-950 text-white rounded-[2rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em]">Coût Total de Production</p>
                    <p className="text-slate-400 mt-2 font-medium text-lg">Pour {result.recipes.reduce((s, r) => s + r.raw_tons, 0).toFixed(2)}t chargées</p>
                  </div>
                  <p className="text-[3.5rem] font-black tracking-tighter text-white">
                    {result.total_factory_cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <span className="text-3xl text-slate-500">TND</span>
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-indigo-100 bg-white/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                        <ShieldCheck className="h-6 w-6" />
                      </span>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-950">{t("aiBusinessReviewTitle")}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiBusinessReviewSubtitle")}</p>
                      </div>
                    </div>
                    {businessReview?.summary && (
                      <p className="mt-5 max-w-3xl text-sm font-bold leading-6 text-slate-700">{businessReview.summary}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-950 px-6 py-5 text-white shadow-lg lg:min-w-52">
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-200">{t("aiGlobalScore")}</p>
                    <p className="mt-1 text-5xl font-black tracking-tight">{businessReview ? businessReview.global_score : "--"}<span className="text-2xl text-slate-500">/100</span></p>
                    <p className="mt-2 text-xs font-bold text-slate-400">{businessReview?.is_grounded ? t("aiGuardedBySolver") : t("aiReviewLoading")}</p>
                  </div>
                </div>

                {businessLoading && (
                  <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm font-bold text-indigo-800">
                    <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-r-indigo-700" />
                    {t("aiReviewLoading")}
                  </div>
                )}

                {businessError && (
                  <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                    {businessError}
                  </div>
                )}

                {businessReview && (
                  <div className="mt-8 space-y-8">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      {Object.entries(businessReview.scores).map(([key, score]) => (
                        <div key={key} className={`rounded-2xl border p-4 ${scoreTone(score.status)}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{score.label}</p>
                          <p className="mt-2 text-3xl font-black">{score.score}<span className="text-base opacity-60">/100</span></p>
                          <p className="mt-2 text-xs font-semibold leading-5 opacity-80">{score.detail}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500">
                          <ClipboardCheck className="h-4 w-4 text-indigo-600" /> {t("aiBusinessAlerts")}
                        </h3>
                        <div className="space-y-3">
                          {businessReview.alerts.map((alert, index) => (
                            <div key={`${alert.title}-${index}`} className={`rounded-2xl border p-4 ${alertTone(alert.severity)}`}>
                              <p className="flex items-center gap-2 text-sm font-black">
                                {alert.severity === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                {alert.title}
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-6 opacity-90">{alert.detail}</p>
                              {alert.evidence && <p className="mt-2 text-xs font-bold opacity-70">{alert.evidence}</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500">
                          <Lightbulb className="h-4 w-4 text-amber-500" /> {t("aiBusinessActions")}
                        </h3>
                        <div className="space-y-3">
                          {businessReview.recommendations.length === 0 && (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                              {t("aiNoRecommendation")}
                            </div>
                          )}
                          {businessReview.recommendations.map((rec, index) => (
                            <div key={`${rec.title}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <p className="text-sm font-black text-slate-950">{rec.title}</p>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ring-1 ${validationTone(rec.validation.status)}`}>
                                  {rec.validation.label}
                                </span>
                              </div>
                              <p className="mt-3 text-sm font-bold leading-6 text-slate-700">{rec.action}</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{rec.impact}</p>
                              <p className="mt-3 text-xs font-bold text-slate-400">{t("aiValidationMethod")}: {rec.validation.method}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" /> {t("aiGuardrails")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {businessReview.guardrails.map((item) => (
                          <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{item}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={runAudit} disabled={auditLoading}
                  className="py-3 px-6 rounded-xl font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 transition-colors shadow-sm flex items-center gap-2">
                  {auditLoading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-300 border-r-emerald-700 animate-spin" />
                      Audit en cours...
                    </>
                  ) : <span className="flex items-center gap-2"><Search className="w-5 h-5 text-emerald-600" /> Lancer l'Audit Nutritionnel & Process IA</span>}
                </button>
              </div>

              {auditResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 shadow-sm animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <Search className="w-6 h-6 text-emerald-600" />
                    <h2 className="text-xl font-black text-emerald-900">Rapport de Contrôle Qualité IA</h2>
                  </div>
                  <div className="prose prose-emerald max-w-none text-emerald-900/80 prose-strong:text-emerald-900 prose-li:marker:text-emerald-400">
                    <ReactMarkdown>{auditResult}</ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {result.recipes.map((rec, idx) => {
                  const originalRec = getOriginalRecipe(rec.name);
                  const chartData = getChartData(rec, originalRec);

                  return (
                    <div key={idx} className="bg-white/80 backdrop-blur-3xl border border-white rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] flex flex-col transition-all duration-500 hover:-translate-y-1">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            {rec.code && <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-xs font-black text-indigo-700 ring-1 ring-indigo-100">{rec.code}</span>}
                            <h3 className="text-slate-900 font-black text-3xl tracking-tight">{rec.name}</h3>
                          </div>
                          <p className="text-slate-500 font-medium mt-2 bg-slate-100/50 px-3 py-1 rounded-lg inline-block">{rec.demand_tons} t finales · {rec.raw_tons} t chargées</p>
                        </div>
                        <div className="md:text-right">
                          <p className="text-indigo-600 font-black text-3xl tracking-tighter">{rec.cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <span className="text-lg">TND</span></p>
                          <p className="text-slate-500 font-bold mt-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs inline-block shadow-sm">
                            {(rec.cost_per_bag_tnd).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND / sac
                          </p>
                        </div>
                      </div>

                      {rec.process_yield_percent < 100 && (
                        <span className="inline-block bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-lg mb-6 border border-orange-200 self-start">
                          Rendement {rec.process_yield_percent}% → Perte d'humidité compensée (+{(rec.raw_tons - rec.demand_tons).toFixed(2)}t)
                        </span>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 flex-1">
                        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex flex-col items-center">
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-4">Répartition</p>
                          <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={rec.ingredients} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="percentage" nameKey="name">
                                  {rec.ingredients.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(val: unknown) => `${Number(val).toFixed(1)}%`} />
                                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex flex-col">
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-4 text-center">Cible vs Atteint</p>
                          <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f3f4f6' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="cible" name="Cible/Min" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="atteint" name="Atteint" fill="#2563eb" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>



                      <div className="flex flex-col gap-3 mt-auto">
                        <button onClick={() => setSelectedReport(rec)} className="w-full py-3.5 rounded-xl bg-gray-900 border border-transparent text-white hover:bg-gray-800 transition-all font-bold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20">
                          <Eye className="w-4 h-4" /> Voir Fiche de Fabrication
                        </button>
                        <div className="flex gap-3">
                          <button onClick={() => {
                            const originalRec2 = getOriginalRecipe(rec.name);
                            const keys = originalRec2?.constraints ? Object.keys(originalRec2.constraints) : [];
                            setParamNutrient(keys[0] || "");
                            const existing = originalRec2?.constraints?.[keys[0]];
                            const baseValue = existing?.exact ?? existing?.min ?? existing?.max ?? 0;
                            setParamTargetRecipeName(rec.name);
                            setParamConstraintMode(existing?.exact !== undefined ? "exact" : existing?.max !== undefined && existing?.min === undefined ? "max" : "min");
                            setParamStart(String(Math.max(0, baseValue - (baseValue * 0.15)).toFixed(1)));
                            setParamEnd(String((baseValue + (baseValue * 0.15)).toFixed(1)));
                            setParamSteps("10");
                            setParamData([]);
                            setParamError(null);
                            setParamModalOpen(true);
                          }} className="flex-1 py-3.5 px-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm text-sm">
                            <LucideLineChart className="w-4 h-4 text-indigo-600" /> Paramétrique
                          </button>
                          <button onClick={() => exportPDF(rec)} disabled={exportingPdf === rec.name} className="flex-1 py-3 px-2 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-xs">
                            {exportingPdf === rec.name ? (
                              <>
                                <div className="w-4 h-4 rounded-full border-2 border-red-300 border-r-red-700 animate-spin" />
                                PDF...
                              </>
                            ) : <><Printer className="w-4 h-4" /> PDF</>}
                          </button>
                          <button onClick={() => exportCSV(rec, originalRec)} className="flex-1 py-3 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-xs">
                            <FileText className="w-4 h-4" /> CSV
                          </button>
                        </div>
                      </div>

                      {/* Hidden PDF Template */}
                      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                        <div id={`pdf-template-${rec.name}`} style={{ width: '800px', backgroundColor: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif' }}>
                          {/* Header */}
                          <div style={{ borderBottom: '2px solid #111', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0', color: '#111827' }}>Mizan Formulation</h1>
                              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#4b5563' }}>Fiche Technique Officielle</h2>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '14px', color: '#374151' }}>
                              <p style={{ margin: '0 0 4px 0' }}><strong>Espèce :</strong> {originalRec?.species || "Générale"}</p>
                              <p style={{ margin: 0 }}><strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>

                          <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>Recette : {rec.code ? `${rec.code} - ` : ""}{rec.name}</h3>
                          </div>

                          {/* Section 1: Composition */}
                          <div style={{ marginBottom: '35px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#111827' }}>1. Composition (Matières Premières)</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f9fafb' }}>
                                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Code</th>
                                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Ingrédient</th>
                                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Inclusion (%)</th>
                                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Quantité (kg/T)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rec.ingredients.map((ing, i) => (
                                  <tr key={ing.name} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '700', color: '#4338ca' }}>{ing.code || "—"}</td>
                                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1f2937' }}>{ing.name}</td>
                                    <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{Math.round(ing.percentage)} %</td>
                                    <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', color: '#059669' }}>{Math.round(ing.percentage * 10)} kg</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Section 2: Nutrition */}
                          <div style={{ marginBottom: '40px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#111827' }}>2. Valeurs Nutritionnelles Garanties</h2>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f9fafb' }}>
                                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Paramètre / Nutriment</th>
                                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Valeur Calculée</th>
                                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Cible Min/Max</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getKeysToPrint(rec.nutrients, originalRec?.constraints, originalRec?.species || "General")
                                  .map(([key, val], i) => {
                                    const cons = originalRec?.constraints?.[key];
                                    let cibleStr = "—";
                                    if (cons) {
                                      if (cons.exact !== undefined) cibleStr = `Exact: ${cons.exact}`;
                                      else if (cons.min !== undefined && cons.max !== undefined) cibleStr = `${cons.min} - ${cons.max}`;
                                      else if (cons.min !== undefined) cibleStr = `Min: ${cons.min}`;
                                      else if (cons.max !== undefined) cibleStr = `Max: ${cons.max}`;
                                    }
                                    return (
                                      <tr key={key} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', color: '#1f2937' }}>{key}</td>
                                        <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', color: '#2563eb' }}>
                                          {val.toFixed(2)} <span style={{ fontSize: '9px', color: '#9ca3af' }}>{getNutrientUnit(key)}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                                          {cibleStr} {cons ? <span style={{ fontSize: '9px' }}>{getNutrientUnit(key)}</span> : ""}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>

                          {/* Footer */}
                          <div style={{ paddingTop: '20px', borderTop: '2px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Document généré automatiquement par Mizan Formulation Engine.</p>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#111827' }}>Coût Total : <span style={{ color: '#2563eb' }}>{rec.cost_tnd.toFixed(2)} TND</span> · <span style={{ color: '#059669' }}>{(rec.cost_tnd / rec.demand_tons).toFixed(2)} TND/T</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedReport && (() => {
          const original = getOriginalRecipe(selectedReport.name);
          return (
            <FicheModal
              report={selectedReport}
              originalConstraints={original?.constraints}
              species={original?.species}
              onClose={() => setSelectedReport(null)}
            />
          );
        })()}

        {/* Parametric Analysis Modal */}
        {paramModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setParamModalOpen(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <LucideLineChart className="w-6 h-6 text-indigo-600" /> {t("parametricAnalysis")}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">{t("parametricSubtitle")}</p>
                </div>
                <button onClick={() => setParamModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-6 h-6" /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("targetRecipe")}</label>
                  <select value={paramTargetRecipeName} onChange={e => setParamTargetRecipeName(e.target.value)}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium">
                    <option value="">{t("allSelectedRecipes")}</option>
                    {selectedSolverRecipeOptions.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("nutrient")}</label>
                  <select value={paramNutrient} onChange={e => setParamNutrient(e.target.value)}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium">
                    <option value="" disabled>{t("chooseNutrient")}</option>
                    {(() => {
                      const allKeys = new Set<string>();
                      recipes.forEach((r) => {
                        if (r.constraints) Object.keys(r.constraints).forEach(k => allKeys.add(k));
                        (r.versions || []).forEach((v) => {
                          if (v.constraints) Object.keys(v.constraints).forEach(k => allKeys.add(k));
                        });
                      });
                      return Array.from(allKeys).sort().map(k => <option key={k} value={k}>{k}</option>);
                    })()}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("constraintMode")}</label>
                  <select value={paramConstraintMode} onChange={e => setParamConstraintMode(e.target.value as "min" | "max" | "exact")}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium">
                    <option value="min">{t("minConstraint")}</option>
                    <option value="max">{t("maxConstraint")}</option>
                    <option value="exact">{t("exactConstraint")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("rangeStart")}</label>
                  <input type="number" value={paramStart} onChange={e => setParamStart(e.target.value)}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("rangeEnd")}</label>
                  <input type="number" value={paramEnd} onChange={e => setParamEnd(e.target.value)}
                    className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t("steps")}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={paramSteps} onChange={e => setParamSteps(e.target.value)}
                      className="flex-1 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
                    <span className="text-xs text-gray-400 font-bold">{getNutrientUnit(paramNutrient)}</span>
                  </div>
                </div>
              </div>

              <button onClick={async () => {
                setParamLoading(true); setParamData([]); setParamError(null);
                try {
                  const { ingredientIds, flatRecipes } = buildOptimizationPayload();
                  const res = await fetch(apiUrl("/api/parametric-analysis"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      nutrient_key: paramNutrient,
                      start_value: parseFloat(paramStart),
                      end_value: parseFloat(paramEnd),
                      steps: parseInt(paramSteps) || 10,
                      ingredient_ids: ingredientIds,
                      recipes: flatRecipes,
                      target_recipe_name: paramTargetRecipeName || null,
                      constraint_mode: paramConstraintMode,
                    }),
                  });
                  if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.detail || "Erreur");
                  }
                  const json = await res.json();
                  setParamData(json.data);
                  setParamLabel(json.nutrient_key);
                } catch (err: unknown) {
                  setParamData([]);
                  setParamError(err instanceof Error ? err.message : "Erreur inconnue");
                }
                finally { setParamLoading(false); }
              }} disabled={paramLoading || !paramNutrient || !paramStart || !paramEnd}
                className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all shadow-md mb-6 ${paramLoading ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer"
                  }`}>
                {paramLoading ? `${t("calculatingParametric")} (GLOP x${paramSteps})` : <><Zap className="w-4 h-4 inline mr-1" />{t("generateCostCurve")}</>}
              </button>

              {paramError && (
                <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {paramError}
                </p>
              )}

              {paramData.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">{t("factoryCostBy")} {paramLabel}</p>
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={paramData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="nutrient_value" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                          label={{ value: paramLabel, position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#9ca3af', fontWeight: 700 } }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                          label={{ value: 'Coût (TND)', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 11, fill: '#9ca3af', fontWeight: 700 } }} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: 'white' }}
                          formatter={(val: unknown) => val === null ? ['Infaisable', 'Coût'] : [`${Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND`, 'Coût']}
                          labelFormatter={(label: unknown) => `${paramLabel}: ${label}`}
                        />
                        <Line type="monotone" dataKey="cost" stroke="#4f46e5" strokeWidth={3} connectNulls={false} dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {paramData.some(d => d.cost === null) && (
                    <p className="flex justify-center items-center gap-1.5 text-center text-orange-600 text-xs font-bold mt-3">
                      <AlertTriangle className="w-4 h-4" /> {t("infeasiblePoints")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
