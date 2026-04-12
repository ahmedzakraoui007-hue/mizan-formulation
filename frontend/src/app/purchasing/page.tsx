"use client";

import { Zap, AlertTriangle, TrendingDown, BrainCircuit, Sparkles, RefreshCcw, HandCoins } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ShadowPrice {
  ingredient_name: string;
  current_price: number;
  target_price: number;
  difference: number;
}

interface RecipeResult {
  name: string;
  demand_tons: number;
  raw_tons: number;
  cost_tnd: number;
  cost_per_bag_tnd: number;
  ingredients: { name: string; tons: number; percentage: number }[];
  nutrients: Record<string, number>;
  shadow_prices?: ShadowPrice[];
}

interface MultiBlendResult {
  status: string;
  total_factory_cost_tnd: number;
  recipes: RecipeResult[];
}

export default function PurchasingPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [result, setResult] = useState<MultiBlendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  // AI State
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
      ]);
      if (ingRes.ok && recRes.ok) {
        setIngredients(await ingRes.json());
        setRecipes(await recRes.json());
      }
    } catch { /* ignored */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runOptimization = async () => {
    setLoading(true); setError(null); setResult(null); setAiInsights(null);
    try {
      const allowedNames = new Set<string>();
      recipes.forEach(r => Object.keys(r.constraints || {}).forEach(k => allowedNames.add(k)));
      const ingredientIds = ingredients.filter(i => allowedNames.has(i.name)).map(i => i.id);

      const res = await fetch(`${API}/api/optimize-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_ids: ingredientIds,
          recipes: recipes.map(({ id, ...rest }: any) => rest),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Échec"); }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { setLoading(false); }
  };

  const runAiAnalysis = async () => {
    if (!result) return;
    setAiLoading(true);
    setAiInsights(null);
    try {
      const res = await fetch(`${API}/api/ai-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("Erreur de l'API IA");
      const data = await res.json();
      setAiInsights(data.markdown);
    } catch {
      setAiInsights("❌ Impossible de joindre l'IA Mizan. Vérifiez votre connexion ou la validité de votre clé API Gemini.");
    } finally {
      setAiLoading(false);
    }
  };

  // Collect all shadow prices across recipes
  const allShadowPrices: (ShadowPrice & { recipe: string })[] = [];
  if (result) {
    result.recipes.forEach(rec => {
      (rec.shadow_prices || []).forEach(sp => {
        allShadowPrices.push({ ...sp, recipe: rec.name });
      });
    });
  }
  allShadowPrices.sort((a, b) => a.difference - b.difference);

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-r-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm font-medium">Chargement des données ERP…</span>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <HandCoins className="w-8 h-8 text-emerald-600" /> Achats & Stratégie
        </h1>
        <p className="text-gray-500 mt-1">Tableau de bord du Directeur des Achats — Prix d'Intérêt, négociations et intelligence artificielle.</p>
      </div>

      {/* Step 1 — Run Optimization */}
      {!result && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm mb-8">
          <p className="text-gray-600 font-medium mb-4">Lancez d'abord une optimisation pour générer les données de Shadow Pricing.</p>
          <button onClick={runOptimization} disabled={loading}
            className={`w-full py-4 rounded-xl font-black text-lg tracking-wide transition-all shadow-lg ${loading ? "bg-gray-300 cursor-not-allowed text-gray-500" : "bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/20 cursor-pointer"
              }`}>
            {loading ? "Optimisation en cours…" : <span className="flex items-center justify-center gap-2"><Zap className="w-5 h-5" /> Lancer l'Optimisation de l'Usine</span>}
          </button>
          {error && <p className="text-red-600 mt-4 font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>}
        </div>
      )}

      {result && (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Coût Total Usine</p>
              <p className="text-3xl font-black text-gray-900">{result.total_factory_cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <span className="text-lg text-gray-400">TND</span></p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ingrédients Non Retenus</p>
              <p className="text-3xl font-black text-red-600">{allShadowPrices.length}</p>
              <p className="text-sm text-gray-500 mt-1">matières avec Prix d'Intérêt</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Plus Proche de Rentabilité</p>
              {allShadowPrices.length > 0 ? (
                <>
                  <p className="text-xl font-black text-emerald-600 truncate">{allShadowPrices[0].ingredient_name}</p>
                  <p className="text-sm text-gray-500 mt-1">écart de seulement <b className="text-emerald-700">{allShadowPrices[0].difference.toFixed(3)} TND</b></p>
                </>
              ) : (
                <p className="text-gray-400 text-sm font-semibold">Toutes les matières sont utilisées.</p>
              )}
            </div>
          </div>

          {/* Section 1: Shadow Prices Table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-black text-gray-900">Opportunités de Négociation (Shadow Prices)</h2>
              </div>
              <p className="text-gray-500 text-sm mt-1">Classé par proximité de rentabilité — le premier de la liste est l'effort de négociation le plus faible.</p>
            </div>
            {allShadowPrices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold tracking-wider uppercase border-b border-gray-200">
                      <th className="py-4 px-6 text-left">Matière Première</th>
                      <th className="py-4 px-6 text-left">Formule</th>
                      <th className="py-4 px-6 text-right">Coût Actuel (TND/kg)</th>
                      <th className="py-4 px-6 text-right">Prix Cible (TND/kg)</th>
                      <th className="py-4 px-6 text-right">Effort Requis</th>
                      <th className="py-4 px-6 text-right">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allShadowPrices.map((sp, idx) => {
                      const effortPct = ((sp.difference / sp.current_price) * 100);
                      const isClose = effortPct < 30;
                      return (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-gray-900">{sp.ingredient_name}</td>
                          <td className="py-4 px-6 text-gray-500">{sp.recipe}</td>
                          <td className="py-4 px-6 text-right font-mono text-red-600 font-bold">{sp.current_price.toFixed(3)}</td>
                          <td className="py-4 px-6 text-right font-mono text-emerald-600 font-bold">{sp.target_price.toFixed(3)}</td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-gray-700">-{sp.difference.toFixed(3)} TND</td>
                          <td className="py-4 px-6 text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 w-fit ml-auto ${isClose ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${isClose ? "bg-emerald-500" : "bg-gray-400"}`} />
                              {isClose ? "Négociable" : "Éloigné"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center border-t border-gray-100">
                <p className="text-gray-600 text-lg font-semibold">Toutes les matières premières sont utilisées dans cette optimisation.</p>
                <p className="text-gray-400 text-sm mt-1">Aucun prix d'intérêt à exploiter.</p>
              </div>
            )}
          </div>

          {/* Section 2: AI Strategic Recommendations */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-black text-gray-900">Recommandations Stratégiques de l'IA</h2>
              </div>
              <button onClick={runAiAnalysis} disabled={aiLoading}
                className="py-2.5 px-5 rounded-xl font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 transition-colors shadow-sm flex items-center gap-2 text-sm">
                {aiLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-r-purple-700 animate-spin" />
                    Analyse en cours...
                  </>
                ) : <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Analyser avec l'IA Mizan</span>}
              </button>
            </div>

            {aiInsights ? (
              <div className="p-8">
                <div className="prose prose-gray max-w-none prose-strong:text-gray-900 prose-li:marker:text-purple-400">
                  <ReactMarkdown>{aiInsights}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p className="text-lg">Cliquez sur "✨ Analyser avec l'IA Mizan" pour générer des recommandations financières ciblées.</p>
                <p className="text-sm mt-1">L'IA utilisera les données de Shadow Pricing pour identifier les meilleures cibles de négociation.</p>
              </div>
            )}
          </div>

          {/* Re-run button */}
          <button onClick={() => { setResult(null); setAiInsights(null); }}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all font-bold text-sm border border-gray-200 flex items-center justify-center gap-2">
            <RefreshCcw className="w-4 h-4" /> Relancer une Optimisation
          </button>
        </div>
      )}
    </div>
  );
}
