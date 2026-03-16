"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import ReactMarkdown from "react-markdown";
import FicheModal from "@/components/FicheModal";

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

  // Parametric Analysis State
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [paramNutrient, setParamNutrient] = useState("");
  const [paramStart, setParamStart] = useState("");
  const [paramEnd, setParamEnd] = useState("");
  const [paramSteps, setParamSteps] = useState("10");
  const [paramData, setParamData] = useState<{ nutrient_value: number; cost: number | null }[]>([]);
  const [paramLoading, setParamLoading] = useState(false);
  const [paramLabel, setParamLabel] = useState("");

  // Stats
  const [stockStats, setStockStats] = useState({ total_stock: 0, total_demand: 0 });
  const [selectedReport, setSelectedReport] = useState<RecipeResult | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        fetch(`${API}/api/ingredients`),
        fetch(`${API}/api/recipes`),
      ]);
      if (ingRes.ok && recRes.ok) {
        const ings = await ingRes.json();
        const recs = await recRes.json();
        setIngredients(ings);
        setRecipes(recs);
        
        let tStock = ings.reduce((s:number, i:any) => s + i.inventory_limit_tons, 0);
        let tDemand = recs.reduce((s:number, r:any) => s + r.demand_tons, 0);
        setStockStats({ total_stock: tStock, total_demand: tDemand });
      }
    } catch { /* ignored */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runFactory = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const allowedNames = new Set<string>();
      recipes.forEach(r => Object.keys(r.constraints || {}).forEach(k => allowedNames.add(k)));
      const ingredientIds = ingredients.filter(i => allowedNames.has(i.name)).map(i => i.id);

      const res = await fetch(`${API}/api/optimize-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_ids: ingredientIds,
          recipes: recipes.map(({ id, ...rest }) => rest),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Échec de l'optimisation"); }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally { setLoading(false); }
  };

  const getChartData = (rec: RecipeResult, originalRec: any) => {
    return Object.entries(rec.nutrients).map(([key, val]) => {
      const c = originalRec?.constraints?.[key];
      let cible = 0;
      if (c?.exact !== undefined) cible = c.exact;
      else if (c?.min !== undefined) cible = c.min;
      const factor = val > 1000 ? 100 : 1; 
      const displayName = val > 1000 ? `${key} (/100)` : key;
      return { name: displayName, cible: cible / factor, atteint: val / factor };
    });
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
            <p className="text-sm font-medium text-blue-600 mt-2">{recipes.length} formules à produire</p>
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
            <p className="text-red-700 text-lg font-bold">⚠ Échec du Solveur</p>
            <p className="text-red-600 mt-2">{error}</p>
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
                const originalRec = recipes.find(r => r.name === rec.name || rec.name.startsWith(r.name));
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



                    <div className="flex gap-3 mt-auto">
                      <button onClick={() => setSelectedReport(rec)} className="flex-1 py-3.5 rounded-xl bg-gray-900 border border-transparent text-white hover:bg-gray-800 transition-all font-bold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20">
                        👁️ Voir Fiche de Fabrication
                      </button>
                      <button onClick={() => {
                        // Pre-populate with first nutrient from recipe constraints
                        const originalRec2 = recipes.find((r: any) => r.name === rec.name || rec.name.startsWith(r.name));
                        const keys = originalRec2?.constraints ? Object.keys(originalRec2.constraints) : [];
                        setParamNutrient(keys[0] || "");
                        const existing = originalRec2?.constraints?.[keys[0]];
                        const baseMin = existing?.min ?? 0;
                        setParamStart(String(Math.max(0, baseMin - (baseMin * 0.15)).toFixed(1)));
                        setParamEnd(String((baseMin + (baseMin * 0.15)).toFixed(1)));
                        setParamSteps("10");
                        setParamData([]);
                        setParamModalOpen(true);
                      }} className="py-3.5 px-5 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 hover:bg-indigo-200 transition-all font-bold cursor-pointer flex items-center justify-center gap-2 shadow-sm text-sm">
                        📈 Paramétrique
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedReport && (
        <FicheModal 
          report={selectedReport} 
          originalConstraints={recipes.find(r => r.name === selectedReport.name || selectedReport.name.startsWith(r.name))?.constraints} 
          onClose={() => setSelectedReport(null)} 
        />
      )}

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
                  {(() => {
                    const allKeys = new Set<string>();
                    recipes.forEach((r: any) => { if (r.constraints) Object.keys(r.constraints).forEach(k => allKeys.add(k)); });
                    return Array.from(allKeys).map(k => <option key={k} value={k}>{k}</option>);
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
                <input type="number" value={paramSteps} onChange={e => setParamSteps(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium" />
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
