"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import ReactMarkdown from "react-markdown";
import FicheModal from "@/components/FicheModal";
import { isNutrientSpecificToSpecies, getNutrientUnit, getTopNutrients } from "@/utils/nutrientUtils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#059669', '#ea580c'];

interface ResultIngredient {
  name: string;
  tons: number;
  percentage: number;
}

interface RecipeResult {
  name: string;
  demand_tons: number;
  raw_tons: number;
  process_yield_percent: number;
  cost_tnd: number;
  bag_size_kg: number;
  cost_per_bag_tnd: number;
  ingredients: ResultIngredient[];
  nutrients: Record<string, number>;
}

interface MultiBlendResult {
  status: string;
  total_factory_cost_tnd: number;
  recipes: RecipeResult[];
}

export default function OptimizationPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  
  const [result, setResult] = useState<MultiBlendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  // Veterinary Auditor AI State
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

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

  // ─── Dynamic Parametric Bounds ──────────────────────────────────────────
  useEffect(() => {
    if (!paramNutrient || recipes.length === 0) return;
    
    // Find the current constraint for this nutrient in any recipe
    // Since parametric analysis in backend overrides ALL recipes with this value,
    // we take the first recipe that has this constraint as a reference point.
    let currentVal: number | null = null;
    for (const r of recipes) {
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

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        // Use lite=true: optimization page only needs ingredient IDs and is_active
        fetch(`${API}/api/ingredients?lite=true`),
        fetch(`${API}/api/recipes`),
      ]);
      if (ingRes.ok && recRes.ok) {
        const ings = await ingRes.json();
        const recs = await recRes.json();
        setIngredients(ings);
        setRecipes(recs);
        
        // Active = explicitly true (the migration now ensures all rows have a value)
        const activeIngs = ings.filter((i: any) => i.is_active === true || i.is_active == null);
        let tStock = activeIngs.reduce((s: number, i: any) => s + (i.inventory_limit_tons || 0), 0);
        // Count all recipes: masters + their versions
        let tDemand = recs.reduce((s: number, r: any) => {
          const masterDemand = r.demand_tons || 0;
          const versionsDemand = (r.versions || []).reduce((vs: number, v: any) => vs + (v.demand_tons || 0), 0);
          return s + masterDemand + versionsDemand;
        }, 0);
        // Count total recipe count (masters + versions)
        const totalRecipeCount = recs.reduce((count: number, r: any) => count + 1 + (r.versions?.length || 0), 0);
        setStockStats({ total_stock: tStock, total_demand: tDemand });
      }
    } catch { /* ignored */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getOriginalRecipe = (name: string) => {
    // Search in masters and versions
    for (const master of recipes) {
      if (master.name === name) return master;
      if (master.versions) {
        const v = master.versions.find((v: any) => v.version_tag === name || `${master.name} (${v.version_tag})` === name || v.name === name);
        if (v) return v;
      }
    }
    return recipes.find(r => name.startsWith(r.name));
  };

  const runFactory = async () => {
    setLoading(true); setError(null); setResult(null); setDiagnoseResult(null);
    try {
      // Send ALL active ingredients to the solver.
      const ingredientIds = ingredients
        .filter((i: any) => i.is_active === true || i.is_active == null)
        .map((i: any) => i.id);

      // Flatten the recipe list: include the master recipe AND every version.
      // The backend solver treats each entry as a separate independent formula.
      // Masters and versions are both complete Recipe objects with their own
      // demand_tons, constraints, and species — the solver optimizes all of them together
      // sharing a global ingredient inventory pool.
      const flatRecipes: any[] = [];
      for (const master of recipes) {
        // Strip UI-only fields (id, versions) before sending to the solver
        const { id: _mid, versions, ...masterFields } = master;
        flatRecipes.push(masterFields);
        // Include each version as a separate recipe
        if (versions && versions.length > 0) {
          for (const ver of versions) {
            const { id: _vid, parent_id: _pid, ...verFields } = ver;
            flatRecipes.push(verFields);
          }
        }
      }

      const res = await fetch(`${API}/api/optimize-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_ids: ingredientIds,
          recipes: flatRecipes,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Échec de l'optimisation"); }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { setLoading(false); }
  };

  const getChartData = (rec: RecipeResult, originalRec: any) => {
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

  const exportPDF = async (rec: RecipeResult, originalRec: any) => {
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

  const exportCSV = (rec: RecipeResult, originalRec: any) => {
    const constraintKeys = originalRec?.constraints ?? {};
    const species = originalRec?.species || "General";
    const filteredNutrients = getKeysToPrint(rec.nutrients, constraintKeys, species);

    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv += `Recette;${rec.name};Espèce;${originalRec?.species || 'Générale'};Date;${new Date().toLocaleDateString('fr-FR')}\n`;
    csv += `\n`;
    csv += `Matière Première;Inclusion (%);Quantité (kg/T)\n`;
    for (const ing of rec.ingredients) {
      csv += `${ing.name};${Math.round(ing.percentage)}%;${Math.round(ing.percentage * 10)}\n`;
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
    csv += `Coût Total (TND/Tonne);${rec.cost_tnd.toFixed(2)}\n`;

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
      const res = await fetch(`${API}/api/ai-audit`, {
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
      const res = await fetch(`${API}/api/recipes/diagnose-infeasible`, {
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
    return (
      <div className="flex items-center justify-center py-20 min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-r-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm font-medium">Chargement des données ERP…</span>
      </div>
    );
  }

  return (
    <>
      <div className="p-10 max-w-7xl mx-auto animate-in fade-in duration-500 pb-24 print:hidden">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Optimisation de l'Usine</h1>
          <p className="text-gray-500 mt-1">Lancer le solveur multi-blend pour satisfaire la demande au moindre coût.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Demande Totale du Carnet</p>
            <div className="text-4xl font-black text-gray-900">{stockStats.total_demand.toFixed(1)} <span className="text-xl text-gray-400">tonnes</span></div>
            <p className="text-sm font-medium text-blue-600 mt-2">
              {recipes.reduce((c: number, r: any) => c + 1 + (r.versions?.length || 0), 0)} formules à produire
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Capacité des Silos</p>
            <div className="text-4xl font-black text-gray-900">{stockStats.total_stock.toFixed(1)} <span className="text-xl text-gray-400">tonnes</span></div>
            <p className="text-sm font-medium text-emerald-600 mt-2">{ingredients.length} matières premières disponibles</p>
          </div>
        </div>

        <button onClick={runFactory} disabled={loading}
          className={`w-full py-5 rounded-2xl font-black text-xl tracking-wide transition-all shadow-xl hover:-translate-y-1 ${
            loading ? "bg-gray-300 cursor-not-allowed text-gray-500 shadow-none hover:translate-y-0" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 cursor-pointer"
          }`}>
          {loading ? "Optimisation en cours…" : "⚡ Lancer l'Optimisation de l'Usine"}
        </button>

        {error && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-red-700 text-lg font-bold flex items-center gap-2">
                  <span>⚠</span> Échec Logique du Solveur Mathématique
                </p>
                <p className="text-red-600 mt-2 font-medium">{error}</p>
                <p className="text-red-500 text-xs mt-1">Les ingrédients disponibles ne permettent pas de satisfaire les contraintes Minimales et Maximales simultanément.</p>
              </div>
              <button onClick={askAIWhy} disabled={diagnoseLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm flex items-center gap-2 flex-shrink-0">
                {diagnoseLoading ? "⏳ Résolution en cours..." : "🤖 Demander à l'IA pourquoi ?"}
              </button>
            </div>

            {diagnoseResult && (
              <div className="mt-6 bg-white border border-red-100 rounded-xl p-6 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                   <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><span>🧠</span> Diagnostic IA Mizan</h3>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown>{diagnoseResult}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-12 space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            <div className="bg-gray-900 text-white rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
              <div>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Coût Total de Production</p>
                <p className="text-gray-300 mt-2 font-medium">Pour {result.recipes.reduce((s,r)=>s+r.raw_tons,0).toFixed(2)}t de matières consommées</p>
              </div>
              <p className="text-5xl font-black tracking-tight text-emerald-400">
                {result.total_factory_cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <span className="text-3xl text-emerald-600/50">TND</span>
              </p>
            </div>

            <div className="flex justify-end">
              <button onClick={runAudit} disabled={auditLoading}
                className="py-3 px-6 rounded-xl font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 transition-colors shadow-sm flex items-center gap-2">
                {auditLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-300 border-r-emerald-700 animate-spin" />
                    Audit en cours...
                  </>
                ) : "🩺 Lancer l'Audit Nutritionnel & Process IA"}
              </button>
            </div>

            {auditResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 shadow-sm animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">🩺</span>
                  <h2 className="text-xl font-black text-emerald-900">Rapport de Contrôle Qualité IA</h2>
                </div>
                <div className="prose prose-emerald max-w-none text-emerald-900/80 prose-strong:text-emerald-900 prose-li:marker:text-emerald-400">
                  <ReactMarkdown>{auditResult}</ReactMarkdown>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {result.recipes.map((rec, idx) => {
                const originalRec = getOriginalRecipe(rec.name);
                const chartData = getChartData(rec, originalRec);

                return (
                  <div key={idx} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-md flex flex-col hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-gray-900 font-black text-2xl">{rec.name}</h3>
                        <p className="text-gray-500 font-medium mt-1">{rec.demand_tons} t finales · {rec.raw_tons} t chargées</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-700 font-black text-2xl">{rec.cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</p>
                        <p className="text-gray-500 font-medium mt-1 bg-gray-100 px-3 py-1 rounded-full text-sm inline-block">{rec.cost_per_bag_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND / sac</p>
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
                              <RechartsTooltip formatter={(val: any) => `${Number(val).toFixed(1)}%`} />
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
                        👁️ Voir Fiche de Fabrication
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => {
                          const originalRec2 = getOriginalRecipe(rec.name);
                          const keys = originalRec2?.constraints ? Object.keys(originalRec2.constraints) : [];
                          setParamNutrient(keys[0] || "");
                          const existing = originalRec2?.constraints?.[keys[0]];
                          const baseMin = existing?.min ?? 0;
                          setParamStart(String(Math.max(0, baseMin - (baseMin * 0.15)).toFixed(1)));
                          setParamEnd(String((baseMin + (baseMin * 0.15)).toFixed(1)));
                          setParamSteps("10");
                          setParamData([]);
                          setParamModalOpen(true);
                        }} className="flex-1 py-3.5 px-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm text-sm">
                          📈 Paramétrique
                        </button>
                        <button onClick={() => exportPDF(rec, originalRec)} disabled={exportingPdf === rec.name} className="flex-1 py-3 px-2 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-xs">
                          {exportingPdf === rec.name ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-red-300 border-r-red-700 animate-spin" />
                              PDF...
                            </>
                          ) : "🖨️ PDF"}
                        </button>
                        <button onClick={() => exportCSV(rec, originalRec)} className="flex-1 py-3 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-xs">
                          📊 CSV
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
                          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>Recette : {rec.name}</h3>
                        </div>
                        
                        {/* Section 1: Composition */}
                        <div style={{ marginBottom: '35px' }}>
                          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#111827' }}>1. Composition (Matières Premières)</h2>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Ingrédient</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Inclusion (%)</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Quantité (kg/T)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rec.ingredients.map((ing, i) => (
                                <tr key={ing.name} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
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
                          <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#111827' }}>Coût Total : <span style={{ color: '#2563eb' }}>{rec.cost_tnd.toFixed(2)} TND / Tonne</span></p>
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
                <h2 className="text-2xl font-black text-gray-900">📈 Analyse Paramétrique</h2>
                <p className="text-gray-500 text-sm mt-1">Faites varier un nutriment pour visualiser l'impact sur le coût total de l'usine.</p>
              </div>
              <button onClick={() => setParamModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nutriment</label>
                <select value={paramNutrient} onChange={e => setParamNutrient(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium">
                  <option value="" disabled>Choisir un nutriment...</option>
                  {(() => {
                    const allKeys = new Set<string>();
                    recipes.forEach((r: any) => { if (r.constraints) Object.keys(r.constraints).forEach(k => allKeys.add(k)); });
                    return Array.from(allKeys).sort().map(k => <option key={k} value={k}>{k}</option>);
                  })()}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Min</label>
                <input type="number" value={paramStart} onChange={e => setParamStart(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Max</label>
                <input type="number" value={paramEnd} onChange={e => setParamEnd(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Pas</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={paramSteps} onChange={e => setParamSteps(e.target.value)}
                    className="flex-1 py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
                  <span className="text-xs text-gray-400 font-bold">{getNutrientUnit(paramNutrient)}</span>
                </div>
              </div>
            </div>

            <button onClick={async () => {
              setParamLoading(true); setParamData([]);
              try {
                const res = await fetch(`${API}/api/parametric-analysis`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    nutrient_key: paramNutrient,
                    start_value: parseFloat(paramStart),
                    end_value: parseFloat(paramEnd),
                    steps: parseInt(paramSteps) || 10,
                  }),
                });
                if (!res.ok) throw new Error("Erreur");
                const json = await res.json();
                setParamData(json.data);
                setParamLabel(json.nutrient_key);
              } catch { setParamData([]); }
              finally { setParamLoading(false); }
            }} disabled={paramLoading}
              className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide transition-all shadow-md mb-6 ${
                paramLoading ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer"
              }`}>
              {paramLoading ? "Calcul en cours… (GLOP ×" + paramSteps + ")" : "⚡ Générer la Courbe de Coût"}
            </button>

            {paramData.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Coût Total Usine (TND) en fonction de {paramLabel}</p>
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
                        formatter={(val: any) => val === null ? ['Infaisable', 'Coût'] : [`${Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND`, 'Coût']}
                        labelFormatter={(label: any) => `${paramLabel}: ${label}`}
                      />
                      <Line type="monotone" dataKey="cost" stroke="#4f46e5" strokeWidth={3} connectNulls={false} dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {paramData.some(d => d.cost === null) && (
                  <p className="text-center text-orange-600 text-xs font-bold mt-3">⚠ Certains points sont infaisables (le solveur n'a pas trouvé de solution optimale).</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
